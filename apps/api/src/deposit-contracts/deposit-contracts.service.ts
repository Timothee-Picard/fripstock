import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import type { Prisma } from '../generated/prisma/client';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { AttachProductsDto } from './dto/attach-products.dto';

const INCLUDE = {
  depositor: { select: { id: true, lastName: true, firstName: true, defaultCommission: true } },
  _count: { select: { products: true } },
} satisfies Prisma.DepositContractInclude;

@Injectable()
export class DepositContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  /**
   * `DepositContract` n'a pas de `companyId` : tout filtre passe par `client`.
   * Voir la règle de scoping via relation parente dans CLAUDE.md.
   */
  private scope(currentUser: CurrentUser): Prisma.DepositContractWhereInput {
    return { depositor: { companyId: currentUser.companyId } };
  }

  list(currentUser: CurrentUser) {
    return this.prisma.depositContract.findMany({
      where: this.scope(currentUser),
      orderBy: { endDate: 'asc' },
      include: INCLUDE,
    });
  }

  async detail(currentUser: CurrentUser, id: string) {
    const contract = await this.prisma.depositContract.findFirst({
      where: { id, ...this.scope(currentUser) },
      include: {
        ...INCLUDE,
        products: {
          orderBy: { createdAt: 'desc' },
          include: { status: true, shop: { select: { id: true, name: true } } },
        },
      },
    });
    if (!contract) throw new NotFoundException('Contrat de dépôt introuvable.');
    return contract;
  }

  async create(currentUser: CurrentUser, dto: CreateContractDto) {
    const depositor = await this.prisma.depositor.findFirst({
      where: { id: dto.depositorId, companyId: currentUser.companyId },
    });
    if (!depositor)
      throw new BadRequestException("Ce déposant n'appartient pas à votre entreprise.");

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('La date de fin doit suivre la date de début.');
    }

    // Contrat et articles dans la même transaction : une ligne refusée ne doit
    // pas laisser derrière elle un contrat vide que personne n'a demandé.
    const contract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.depositContract.create({
        data: {
          depositorId: depositor.id,
          startDate,
          endDate,
          // Copiée depuis le déposant à la création, modifiable ensuite pour ce
          // contrat précis (voir CLAUDE.md).
          commission: dto.commission ?? depositor.defaultCommission,
          notifyBeforeDays: dto.notifyBeforeDays ?? 7,
        },
      });

      for (const [index, line] of (dto.products ?? []).entries()) {
        try {
          await this.products.createWith(tx, currentUser, {
            ...line,
            saleType: 'CONSIGNMENT',
            depositContractId: created.id,
          });
        } catch (error) {
          // Sans le numéro de ligne, « Cette catégorie n'appartient pas à votre
          // entreprise » est inexploitable sur un dépôt de trente articles.
          throw new BadRequestException(
            `Article ${index + 1} (${line.name}) : ${(error as Error).message}`,
          );
        }
      }

      return created;
    });

    return this.detail(currentUser, contract.id);
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateContractDto) {
    const contract = await this.detail(currentUser, id);

    const startDate = dto.startDate ? new Date(dto.startDate) : contract.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : contract.endDate;
    if (endDate <= startDate) {
      throw new BadRequestException('La date de fin doit suivre la date de début.');
    }

    return this.prisma.depositContract.update({
      where: { id },
      data: {
        startDate,
        endDate,
        ...(dto.commission !== undefined ? { commission: dto.commission } : {}),
        ...(dto.notifyBeforeDays !== undefined ? { notifyBeforeDays: dto.notifyBeforeDays } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        // Repousser l'échéance doit pouvoir re-déclencher une alerte : sinon le
        // contrat prolongé resterait marqué comme déjà notifié.
        ...(dto.endDate !== undefined ? { notifiedAt: null } : {}),
      },
      include: INCLUDE,
    });
  }

  async delete(currentUser: CurrentUser, id: string) {
    await this.detail(currentUser, id);
    const products = await this.prisma.product.count({ where: { depositContractId: id } });
    if (products > 0) {
      throw new ConflictException(
        `Ce contrat porte ${products} produit(s). Détachez-les avant de le supprimer.`,
      );
    }
    await this.prisma.depositContract.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Rattache des produits existants au contrat, et les bascule en dépôt-vente.
   *
   * Un produit déjà vendu est refusé : sa commission a été figée d'après son
   * contrat d'alors, le rattacher ailleurs falsifierait un relevé.
   */
  async attachProducts(currentUser: CurrentUser, id: string, dto: AttachProductsDto) {
    await this.detail(currentUser, id);

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.productIds }, companyId: currentUser.companyId },
      include: {
        status: { select: { isSale: true, name: true } },
        depositContract: {
          select: { id: true, depositor: { select: { lastName: true, firstName: true } } },
        },
      },
    });
    if (products.length !== dto.productIds.length) {
      throw new BadRequestException("Un produit cité n'appartient pas à votre entreprise.");
    }

    // Un produit n'appartient qu'à un contrat à la fois. Le déplacer en silence
    // le retirerait du relevé du premier déposant sans que personne ne le voie.
    const ailleurs = products.filter((p) => p.depositContractId && p.depositContractId !== id);
    if (ailleurs.length > 0) {
      const details = ailleurs
        .map((p) => {
          const d = p.depositContract!.depositor;
          const nom = [d.firstName, d.lastName].filter(Boolean).join(' ');
          return `${p.name} (${nom})`;
        })
        .join(', ');
      throw new ConflictException(
        `Déjà sur un autre contrat de dépôt : ${details}. Détachez-les d'abord.`,
      );
    }

    const sold = products.filter((p) => p.status.isSale);
    if (sold.length > 0) {
      throw new ConflictException(
        `Déjà vendu(s), ces produits ne peuvent plus changer de contrat : ${sold
          .map((p) => p.name)
          .join(', ')}.`,
      );
    }

    await this.prisma.product.updateMany({
      where: { id: { in: dto.productIds } },
      data: {
        depositContractId: id,
        saleType: 'CONSIGNMENT',
        // L'article appartient au déposant : le prix d'achat n'a plus de sens.
        purchasePrice: null,
        depositorPaid: false,
      },
    });

    return this.detail(currentUser, id);
  }

  /** Détache un produit de son contrat et le repasse en achat-revente. */
  async detachProduct(currentUser: CurrentUser, id: string, productId: string) {
    await this.detail(currentUser, id);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, depositContractId: id, companyId: currentUser.companyId },
      include: { status: { select: { isSale: true } } },
    });
    if (!product) throw new NotFoundException('Produit introuvable dans ce contrat.');
    if (product.status.isSale) {
      throw new ConflictException(
        'Ce produit est vendu : le détacher fausserait le relevé du déposant.',
      );
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { depositContractId: null, saleType: 'RESALE', depositorPaid: null },
    });
    return this.detail(currentUser, id);
  }
}
