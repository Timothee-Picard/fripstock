import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { CurrentUser } from '../common/types/current-user';
import { depositorCode, freeCode } from '../products/references';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDepositorDto } from './dto/create-depositor.dto';
import type { UpdateDepositorDto } from './dto/update-depositor.dto';

/** Deux décimales, en nombre : les montants transitent en JSON. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class DepositorsService {
  constructor(private readonly prisma: PrismaService) {}

  list(currentUser: CurrentUser) {
    return this.prisma.depositor.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { _count: { select: { contracts: true } } },
    });
  }

  async detail(currentUser: CurrentUser, id: string) {
    const depositor = await this.prisma.depositor.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: {
        contracts: {
          orderBy: { endDate: 'desc' },
          include: { _count: { select: { products: true } } },
        },
      },
    });
    if (!depositor) throw new NotFoundException('Client déposant introuvable.');
    return depositor;
  }

  async create(currentUser: CurrentUser, dto: CreateDepositorDto) {
    // Le code apparaît dans les références de ses articles (le MAR de
    // D-MAR-001). On le pose dès la création pour que le gérant le voie et
    // puisse le corriger avant qu'une étiquette ne l'emporte.
    const code = await this.uniqueCode(currentUser.companyId, dto);

    return this.onDuplicateCode(dto.code, () =>
      this.prisma.depositor.create({
        data: {
          ...dto,
          companyId: currentUser.companyId,
          defaultCommission: dto.defaultCommission ?? 0,
          code,
        },
      }),
    );
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateDepositorDto) {
    await this.require(currentUser, id);
    return this.onDuplicateCode(dto.code, () =>
      this.prisma.depositor.update({ where: { id }, data: dto }),
    );
  }

  /** Traduit un code déposant déjà pris en refus lisible. */
  private async onDuplicateCode<T>(code: string | undefined, ecriture: () => Promise<T>) {
    try {
      return await ecriture();
    } catch (error) {
      if (isUniqueViolation(error, 'code')) {
        throw new ConflictException(`Le code « ${code ?? ''} » est déjà pris par un déposant.`);
      }
      throw error;
    }
  }

  /**
   * Code libre le plus proche de celui que suggère le nom.
   *
   * Un code fourni est repris tel quel — c'est le gérant qui décide ; la
   * contrainte d'unicité en base tranchera s'il double un existant.
   */
  private async uniqueCode(companyId: string, dto: CreateDepositorDto): Promise<string> {
    if (dto.code?.trim()) return dto.code.trim().toUpperCase();

    const autres = await this.prisma.depositor.findMany({
      where: { companyId, code: { not: null } },
      select: { code: true },
    });
    return freeCode(
      depositorCode(dto.lastName, dto.firstName),
      new Set(autres.map((d) => d.code).filter((c): c is string => c !== null)),
    );
  }

  async delete(currentUser: CurrentUser, id: string) {
    await this.require(currentUser, id);
    const contracts = await this.prisma.depositContract.count({ where: { depositorId: id } });
    if (contracts > 0) {
      throw new ConflictException(
        `Ce déposant a ${contracts} contrat(s). Clôturez-les et détachez ses produits d'abord.`,
      );
    }
    await this.prisma.depositor.delete({ where: { id } });
    return { deleted: true };
  }

  /** Produits déposés par ce déposant, tous contrats confondus. */
  async products(currentUser: CurrentUser, id: string) {
    await this.require(currentUser, id);
    return this.prisma.product.findMany({
      // Pas de depositorId sur Produit : on passe par le contrat, lui-même scopé
      // par son déposant. Voir la règle de scoping de CLAUDE.md.
      where: {
        depositContract: { depositorId: id, depositor: { companyId: currentUser.companyId } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        status: true,
        shop: { select: { id: true, name: true } },
        depositContract: { select: { id: true, startDate: true, endDate: true, status: true } },
      },
    });
  }

  /**
   * Relevé du déposant : ce qui a été vendu, ce qui lui revient, ce qui a été
   * réglé.
   *
   * Deux règles y sont capitales, et toutes deux viennent de CLAUDE.md :
   *
   * - la commission est la **part que garde la boutique**, donc
   *   `depositorShare = soldPrice × (1 − commission / 100)` ;
   * - on lit `Product.appliedCommission`, figée à la vente, et jamais celle du
   *   contrat : sinon update un contrat réécrirait des relevés déjà réglés.
   *
   * Un produit compte comme vendu si son statut porte `isSale` — jamais sur
   * son libellé, que le gérant peut renommer.
   */
  async statement(currentUser: CurrentUser, id: string) {
    const depositor = await this.require(currentUser, id);

    const products = await this.prisma.product.findMany({
      where: {
        depositContract: { depositorId: id, depositor: { companyId: currentUser.companyId } },
        status: { isSale: true },
      },
      orderBy: { soldAt: 'desc' },
      include: { status: { select: { id: true, name: true, color: true } } },
    });

    const lines = products.map((p) => {
      const soldPrice = Number(p.soldPrice ?? 0);
      const commission = Number(p.appliedCommission ?? 0);
      const shopShare = round((soldPrice * commission) / 100);
      return {
        productId: p.id,
        reference: p.reference,
        name: p.name,
        soldAt: p.soldAt,
        status: p.status,
        soldPrice: round(soldPrice),
        commission: round(commission),
        shopShare,
        depositorShare: round(soldPrice - shopShare),
        depositorPaid: p.depositorPaid === true,
      };
    });

    const sum = (
      filter: (l: (typeof lines)[number]) => boolean,
      field: 'depositorShare' | 'soldPrice',
    ) => round(lines.filter(filter).reduce((total, l) => total + l[field], 0));

    return {
      depositor: {
        id: depositor.id,
        lastName: depositor.lastName,
        firstName: depositor.firstName,
        iban: depositor.iban,
        defaultCommission: depositor.defaultCommission,
      },
      lines,
      totals: {
        soldCount: lines.length,
        soldTotal: sum(() => true, 'soldPrice'),
        shopShare: round(lines.reduce((t, l) => t + l.shopShare, 0)),
        depositorShare: sum(() => true, 'depositorShare'),
        alreadyPaid: sum((l) => l.depositorPaid, 'depositorShare'),
        outstanding: sum((l) => !l.depositorPaid, 'depositorShare'),
      },
    };
  }

  private async require(currentUser: CurrentUser, id: string) {
    const depositor = await this.prisma.depositor.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!depositor) throw new NotFoundException('Client déposant introuvable.');
    return depositor;
  }
}
