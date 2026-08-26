import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatusesService } from '../statuses/statuses.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  normalizeValue,
  type ApplicableAttribute,
  type NormalisedValue,
} from './attributes.validation';
import type { AssignShopDto } from './dto/assign-shop.dto';
import type { ChangeStatusDto } from './dto/change-status.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { FilterProductsDto } from './dto/filter-products.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateSaleDto } from './dto/update-sale.dto';
import type { ValueAttributeDto } from './dto/attribute-value.dto';
import { dateFr, frNumber, ouiNon, versCsv } from './csv-export';

const PAR_PAGE_DEFAUT = 25;

const DETAIL_INCLUDE = {
  category: { select: { id: true, name: true } },
  shop: { select: { id: true, name: true } },
  status: true,
  depositContract: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      commission: true,
      depositor: { select: { id: true, lastName: true, firstName: true } },
    },
  },
  attributeValues: { include: { attribute: { select: { id: true, name: true, type: true } } } },
  attributeOptions: {
    include: {
      option: { include: { attribute: { select: { id: true, name: true, type: true } } } },
    },
  },
} satisfies Prisma.ProductInclude;

/**
 * Résolveur pour @ShopFromResource : la boutique d'un produit n'est ni
 * dans les params ni dans le body, il faut charger le produit.
 *
 * Fonction autonome et non méthode statique : elle est passée en valeur au
 * décorateur, donc jamais liée à une instance.
 *
 * La requête est scopée à l'entreprise, sinon elle permettrait de sonder
 * l'existence de produits d'ailleurs.
 */
export async function boutiqueDuProduct(
  prisma: PrismaService,
  id: string,
  companyId: string,
): Promise<string | null> {
  const product = await prisma.product.findFirst({
    where: { id, companyId },
    select: { shopId: true },
  });
  return product?.shopId ?? null;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: StatusesService,
    private readonly uploads: UploadsService,
  ) {}

  async list(currentUser: CurrentUser, filters: FilterProductsDto) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? PAR_PAGE_DEFAUT;
    const where = await this.buildFilter(currentUser, filters);

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          category: { select: { id: true, name: true } },
          shop: { select: { id: true, name: true } },
          status: true,
        },
      }),
    ]);

    return { products, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
  }

  /**
   * Export CSV du stock, avec **exactement les mêmes filtres** que la liste :
   * on exporte ce qu'on voit à l'écran, sous-ensemble filtré ou stock complet.
   *
   * Colonnes fixes puis une colonne par attribut réellement présent dans le
   * résultat — c'est ce qui rend au client la souplesse de son tableur, sans
   * traîner une colonne « Taille » vide sur un export de sacs.
   */
  async exportCsv(currentUser: CurrentUser, filters: FilterProductsDto): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: await this.buildFilter(currentUser, filters),
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        shop: { select: { name: true } },
        status: { select: { name: true } },
        depositContract: { select: { depositor: { select: { lastName: true, firstName: true } } } },
        attributeValues: { include: { attribute: { select: { name: true } } } },
        attributeOptions: {
          include: { option: { include: { attribute: { select: { name: true } } } } },
        },
      },
    });

    // Valeurs d'attributs, regroupées par produit puis par nom d'attribut.
    const attributesByProduct = new Map<string, Map<string, string[]>>();
    const dynamicColumns = new Set<string>();

    for (const product of products) {
      const byName = new Map<string, string[]>();
      for (const v of product.attributeValues) {
        const raw =
          v.textValue ??
          v.numberValue?.toString() ??
          (v.booleanValue === null ? null : v.booleanValue ? 'oui' : 'non');
        if (raw !== null) byName.set(v.attribute.name, [raw]);
      }
      for (const o of product.attributeOptions) {
        const name = o.option.attribute.name;
        byName.set(name, [...(byName.get(name) ?? []), o.option.value]);
      }
      for (const name of byName.keys()) dynamicColumns.add(name);
      attributesByProduct.set(product.id, byName);
    }

    const dynamicHeaders = [...dynamicColumns].sort((a, b) => a.localeCompare(b));

    const headers = [
      'Référence',
      'Catégorie',
      'Boutique',
      'Nom',
      'Description',
      'Commentaire',
      'Statut',
      'Type de vente',
      "Prix d'achat",
      'Prix de vente',
      'Prix vendu',
      'Date de vente',
      'Déposant',
      'Commission appliquée',
      'Déposant payé',
      ...dynamicHeaders,
    ];

    const lines = products.map((p) => {
      const attributes = attributesByProduct.get(p.id) ?? new Map<string, string[]>();
      const depositor = p.depositContract?.depositor
        ? [p.depositContract.depositor.firstName, p.depositContract.depositor.lastName]
            .filter(Boolean)
            .join(' ')
        : '';
      return [
        p.reference ?? '',
        p.category.name,
        p.shop?.name ?? 'Stock central',
        p.name,
        p.description ?? '',
        p.internalNote ?? '',
        p.status.name,
        p.saleType === 'CONSIGNMENT' ? 'Dépôt-vente' : 'Achat-revente',
        frNumber(p.purchasePrice?.toString() ?? null),
        frNumber(p.salePrice?.toString() ?? null),
        frNumber(p.soldPrice?.toString() ?? null),
        dateFr(p.soldAt),
        depositor,
        frNumber(p.appliedCommission?.toString() ?? null),
        ouiNon(p.depositorPaid),
        ...dynamicHeaders.map((name) => attributes.get(name)?.join(', ') ?? ''),
      ];
    });

    return versCsv(headers, lines);
  }

  /**
   * Filtre commun à la liste et à l'export : les deux doivent voir exactement
   * le même sous-ensemble, sinon exportCsv « ce qu'on voit » devient un
   * mensonge.
   */
  private async buildFilter(
    currentUser: CurrentUser,
    filters: FilterProductsDto,
  ): Promise<Prisma.ProductWhereInput> {
    return {
      companyId: currentUser.companyId,
      ...(await this.restrictionShops(currentUser, filters)),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.statusId ? { statusId: filters.statusId } : {}),
      ...(filters.saleType ? { saleType: filters.saleType } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { reference: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters.createdAfter || filters.createdBefore
        ? {
            createdAt: {
              ...(filters.createdAfter ? { gte: new Date(filters.createdAfter) } : {}),
              ...(filters.createdBefore ? { lte: new Date(filters.createdBefore) } : {}),
            },
          }
        : {}),
      ...(filters.soldAfter || filters.soldBefore
        ? {
            soldAt: {
              ...(filters.soldAfter ? { gte: new Date(filters.soldAfter) } : {}),
              ...(filters.soldBefore ? { lte: new Date(filters.soldBefore) } : {}),
            },
          }
        : {}),
    };
  }

  async detail(currentUser: CurrentUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: {
        ...DETAIL_INCLUDE,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          include: {
            status: { select: { id: true, name: true, color: true } },
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Produit introuvable.');
    await this.requireShopAccess(currentUser, product.shopId);
    return product;
  }

  async create(currentUser: CurrentUser, dto: CreateProductDto) {
    await this.requireCategory(currentUser, dto.categoryId);
    if (dto.shopId) await this.requireShop(currentUser, dto.shopId);

    const status = dto.statusId
      ? await this.requireStatus(currentUser, dto.statusId)
      : await this.statuses.defaults(currentUser.companyId);

    const contract = await this.checkSaleType(currentUser, dto.saleType, dto.depositContractId);
    const values = await this.normalizeAttributes(
      currentUser,
      dto.categoryId,
      dto.attributes ?? [],
    );

    const product = await this.prisma.$transaction(async (tx) => {
      const cree = await tx.product.create({
        data: {
          companyId: currentUser.companyId,
          shopId: dto.shopId ?? null,
          categoryId: dto.categoryId,
          statusId: status.id,
          name: dto.name,
          reference: dto.reference ?? null,
          description: dto.description ?? null,
          internalNote: dto.internalNote ?? null,
          photoUrl: dto.photoUrl ?? null,
          purchasePrice: dto.saleType === 'RESALE' ? (dto.purchasePrice ?? null) : null,
          salePrice: dto.salePrice ?? null,
          quantity: dto.quantity ?? 1,
          saleType: dto.saleType,
          depositContractId: contract?.id ?? null,
          depositorPaid: dto.saleType === 'CONSIGNMENT' ? false : null,
        },
      });
      await this.ecrireValues(tx, cree.id, values);
      await tx.statusHistory.create({
        data: {
          productId: cree.id,
          statusId: status.id,
          changedByUserId: currentUser.userId,
          note: 'Création du produit',
        },
      });
      return cree;
    });

    return this.detail(currentUser, product.id);
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateProductDto) {
    const product = await this.loadForWrite(currentUser, id);

    const categoryId = dto.categoryId ?? product.categoryId;
    if (dto.categoryId) await this.requireCategory(currentUser, dto.categoryId);
    if (dto.shopId) await this.requireShop(currentUser, dto.shopId);

    const saleType = dto.saleType ?? product.saleType;
    const contract = await this.checkSaleType(
      currentUser,
      saleType,
      dto.depositContractId ?? product.depositContractId ?? undefined,
    );

    // Changer de catégorie peut rendre des attributs inapplicables : on
    // revalide l'ensemble contre la catégorie finale.
    const values =
      dto.attributes !== undefined || dto.categoryId !== undefined
        ? await this.normalizeAttributes(
            currentUser,
            categoryId,
            dto.attributes ?? (await this.currentValues(id)),
          )
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.shopId !== undefined ? { shopId: dto.shopId } : {}),
          ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.internalNote !== undefined ? { internalNote: dto.internalNote } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
          ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.saleType !== undefined ? { saleType: dto.saleType } : {}),
          // purchasePrice n'a de sens qu'en achat-revente (voir CLAUDE.md).
          ...(saleType === 'RESALE'
            ? dto.purchasePrice !== undefined
              ? { purchasePrice: dto.purchasePrice }
              : {}
            : { purchasePrice: null }),
          depositContractId: contract?.id ?? null,
          ...(saleType === 'CONSIGNMENT'
            ? product.depositorPaid === null
              ? { depositorPaid: false }
              : {}
            : { depositorPaid: null }),
        },
      });
      if (values) {
        await tx.attributeValue.deleteMany({ where: { productId: id } });
        await tx.productAttributeOption.deleteMany({ where: { productId: id } });
        await this.ecrireValues(tx, id, values);
      }
    });

    return this.detail(currentUser, id);
  }

  async assignShop(currentUser: CurrentUser, id: string, dto: AssignShopDto) {
    await this.loadForWrite(currentUser, id);
    if (dto.shopId) await this.requireShop(currentUser, dto.shopId);

    await this.prisma.product.update({
      where: { id },
      data: { shopId: dto.shopId ?? null },
    });
    return this.detail(currentUser, id);
  }

  /**
   * Change le statut d'un produit.
   *
   * Toutes les règles reposent sur les flags de `Status`, jamais sur le
   * libellé : le gérant peut renommer ses statuts. Voir CLAUDE.md.
   */
  async changeStatus(currentUser: CurrentUser, id: string, dto: ChangeStatusDto) {
    const product = await this.loadForWrite(currentUser, id);
    const actuel = await this.prisma.status.findUniqueOrThrow({ where: { id: product.statusId } });
    const target = await this.requireStatus(currentUser, dto.statusId);

    // Le flux de l'entreprise, s'il est défini, dit quelles transitions sont
    // permises. Les règles de flags s'appliquent par-dessus.
    await this.statuses.checkTransition(currentUser.companyId, actuel.id, target.id);

    // Un produit rendu ou retiré ne redevient jamais vendable.
    if (actuel.blocksSale && target.isSale) {
      throw new ForbiddenException(
        `Ce produit est « ${actuel.name} » : il ne peut plus être vendu.`,
      );
    }
    if (actuel.blocksSale && dto.soldPrice !== undefined) {
      throw new ForbiddenException(
        `Ce produit est « ${actuel.name} » : son prix vendu ne peut plus être modifié.`,
      );
    }

    if (!target.isSale && (dto.soldPrice !== undefined || dto.soldAt !== undefined)) {
      throw new BadRequestException(
        `« ${target.name} » n'est pas un statut de vente : prix vendu et date de vente ne s'appliquent pas.`,
      );
    }

    let saleData: Prisma.ProductUpdateInput = {};
    if (target.isSale) {
      if (dto.soldPrice === undefined) {
        throw new BadRequestException(
          `« ${target.name} » est un statut de vente : indiquez le prix vendu.`,
        );
      }
      saleData = {
        soldPrice: dto.soldPrice,
        soldAt: dto.soldAt ? new Date(dto.soldAt) : new Date(),
      };
      // Gel de la commission : le relevé, l'export et les stats liront cette
      // valeur, jamais celle du contrat, qui peut changer après coup.
      if (product.saleType === 'CONSIGNMENT' && product.depositContractId) {
        const contract = await this.prisma.depositContract.findUniqueOrThrow({
          where: { id: product.depositContractId },
          select: { commission: true },
        });
        saleData.appliedCommission = contract.commission;
      }
    }

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: { status: { connect: { id: target.id } }, ...saleData },
      }),
      this.prisma.statusHistory.create({
        data: {
          productId: id,
          statusId: target.id,
          changedByUserId: currentUser.userId,
          note: dto.note ?? null,
        },
      }),
    ]);

    return this.detail(currentUser, id);
  }

  /**
   * Corrige les données de vente d'un produit déjà vendu : prix encaissé, date,
   * et commission appliquée en dépôt-vente.
   *
   * Un produit dont le statut porte `blocksSale` en est exclu — c'est la règle
   * de CLAUDE.md : rendu au déposant, son prix vendu ne se modifie plus.
   */
  async updateSale(currentUser: CurrentUser, id: string, dto: UpdateSaleDto) {
    const product = await this.loadForWrite(currentUser, id);
    const status = await this.prisma.status.findUniqueOrThrow({
      where: { id: product.statusId },
    });

    if (!status.isSale) {
      throw new BadRequestException(
        `« ${status.name} » n'est pas un statut de vente : il n'y a pas de vente à corriger.`,
      );
    }
    if (status.blocksSale) {
      throw new ForbiddenException(
        `Ce produit est « ${status.name} » : ses données de vente ne peuvent plus être modifiées.`,
      );
    }
    if (dto.appliedCommission !== undefined && product.saleType !== 'CONSIGNMENT') {
      throw new BadRequestException("La commission ne s'applique qu'aux produits en dépôt-vente.");
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.soldPrice !== undefined ? { soldPrice: dto.soldPrice } : {}),
        ...(dto.soldAt !== undefined ? { soldAt: new Date(dto.soldAt) } : {}),
        ...(dto.appliedCommission !== undefined
          ? { appliedCommission: dto.appliedCommission }
          : {}),
      },
    });

    return this.detail(currentUser, id);
  }

  /**
   * Bascule le règlement du déposant.
   *
   * Placé ici et non dans les contrats : c'est un champ du produit, et le guard
   * y retrouve déjà la boutique par la ressource. Paiement en espèces, donc
   * rien de plus qu'un drapeau coché à la main (voir CLAUDE.md).
   */
  async toggleDepositorPayment(currentUser: CurrentUser, id: string, paid: boolean) {
    const product = await this.loadForWrite(currentUser, id);
    if (product.saleType !== 'CONSIGNMENT') {
      throw new BadRequestException("Ce produit n'est pas en dépôt-vente.");
    }

    const status = await this.prisma.status.findUniqueOrThrow({
      where: { id: product.statusId },
      select: { isSale: true, name: true },
    });
    if (!status.isSale) {
      throw new BadRequestException(
        `« ${status.name} » n'est pas un statut de vente : il n'y a rien à reverser au déposant.`,
      );
    }

    await this.prisma.product.update({ where: { id }, data: { depositorPaid: paid } });
    return this.detail(currentUser, id);
  }

  async delete(currentUser: CurrentUser, id: string) {
    const product = await this.loadForWrite(currentUser, id);
    await this.prisma.product.delete({ where: { id } });
    if (product.photoUrl) await this.uploads.delete(product.photoUrl);
    return { supprime: true };
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Restriction de visibilité d'un employé : ses boutiques, plus le stock
   * central. Voir la règle « Produits non assignés » de CLAUDE.md.
   */
  private async restrictionShops(
    currentUser: CurrentUser,
    filters: FilterProductsDto,
  ): Promise<Prisma.ProductWhereInput> {
    if (filters.unassigned === 'true') return { shopId: null };
    if (filters.shopId) {
      await this.requireShop(currentUser, filters.shopId);
      return { shopId: filters.shopId };
    }
    if (currentUser.isManager) return {};

    const accesses = await this.prisma.shopAccess.findMany({
      where: { userId: currentUser.userId, shop: { companyId: currentUser.companyId } },
      select: { shopId: true },
    });
    return { OR: [{ shopId: null }, { shopId: { in: accesses.map((a) => a.shopId) } }] };
  }

  private async requireShopAccess(currentUser: CurrentUser, shopId: string | null) {
    if (currentUser.isManager || shopId === null) return;
    const accesses = await this.prisma.shopAccess.count({
      where: { userId: currentUser.userId, shopId },
    });
    if (accesses === 0) throw new NotFoundException('Produit introuvable.');
  }

  private async loadForWrite(currentUser: CurrentUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!product) throw new NotFoundException('Produit introuvable.');
    await this.requireShopAccess(currentUser, product.shopId);
    return product;
  }

  private async requireCategory(currentUser: CurrentUser, id: string) {
    const c = await this.prisma.category.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!c) throw new BadRequestException("Cette catégorie n'appartient pas à votre entreprise.");
  }

  private async requireShop(currentUser: CurrentUser, id: string) {
    const b = await this.prisma.shop.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!b) throw new BadRequestException("Cette boutique n'appartient pas à votre entreprise.");
  }

  private async requireStatus(currentUser: CurrentUser, id: string) {
    const s = await this.prisma.status.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!s) throw new BadRequestException("Ce statut n'appartient pas à votre entreprise.");
    return s;
  }

  /** `CONSIGNMENT` exige un contrat ; `RESALE` en refuse un. */
  private async checkSaleType(
    currentUser: CurrentUser,
    saleType: 'RESALE' | 'CONSIGNMENT',
    depositContractId?: string,
  ) {
    if (saleType === 'RESALE') {
      if (depositContractId) {
        throw new BadRequestException(
          "Un produit en achat-revente n'est rattaché à aucun contrat de dépôt.",
        );
      }
      return null;
    }

    if (!depositContractId) {
      throw new BadRequestException('Un produit en dépôt-vente doit être rattaché à un contrat.');
    }
    const contract = await this.prisma.depositContract.findFirst({
      // Pas de companyId sur DepositContract : le cloisonnement passe par le déposant.
      where: { id: depositContractId, depositor: { companyId: currentUser.companyId } },
      select: { id: true },
    });
    if (!contract) {
      throw new BadRequestException("Ce contrat de dépôt n'appartient pas à votre entreprise.");
    }
    return contract;
  }

  /** Valide chaque valeur contre les attributs réellement applicables à la catégorie. */
  private async normalizeAttributes(
    currentUser: CurrentUser,
    categoryId: string,
    values: ValueAttributeDto[],
  ): Promise<NormalisedValue[]> {
    if (values.length === 0) return [];

    const liens = await this.prisma.categoryAttribute.findMany({
      where: { categoryId, attribute: { companyId: currentUser.companyId } },
      include: { attribute: { include: { options: { orderBy: { position: 'asc' } } } } },
    });
    const applicables = new Map<string, ApplicableAttribute>(
      liens.map((l) => [l.attribute.id, l.attribute]),
    );

    const vus = new Set<string>();
    return values.map((v) => {
      const attribute = applicables.get(v.attributeDefinitionId);
      if (!attribute) {
        throw new BadRequestException(
          "Un attribut fourni ne s'applique pas à la catégorie choisie.",
        );
      }
      if (vus.has(attribute.id)) {
        throw new BadRequestException(`« ${attribute.name} » est renseigné deux fois.`);
      }
      vus.add(attribute.id);
      return normalizeValue(attribute, v.value);
    });
  }

  private async currentValues(productId: string): Promise<ValueAttributeDto[]> {
    const [values, options] = await Promise.all([
      this.prisma.attributeValue.findMany({ where: { productId } }),
      this.prisma.productAttributeOption.findMany({
        where: { productId },
        include: { option: { select: { id: true, attributeDefinitionId: true } } },
      }),
    ]);

    const result: ValueAttributeDto[] = values.map((v) => ({
      attributeDefinitionId: v.attributeDefinitionId,
      value: v.textValue ?? v.numberValue?.toString() ?? v.booleanValue,
    }));

    const byAttribute = new Map<string, string[]>();
    for (const o of options) {
      const list = byAttribute.get(o.option.attributeDefinitionId) ?? [];
      list.push(o.option.id);
      byAttribute.set(o.option.attributeDefinitionId, list);
    }
    for (const [attributeDefinitionId, ids] of byAttribute) {
      result.push({ attributeDefinitionId, value: ids.length === 1 ? ids[0] : ids });
    }
    return result;
  }

  private async ecrireValues(
    tx: Prisma.TransactionClient,
    productId: string,
    values: NormalisedValue[],
  ) {
    for (const v of values) {
      if (v.optionIds.length > 0) {
        await tx.productAttributeOption.createMany({
          data: v.optionIds.map((attributeOptionId) => ({ productId, attributeOptionId })),
        });
      } else {
        await tx.attributeValue.create({
          data: {
            productId,
            attributeDefinitionId: v.attributeDefinitionId,
            textValue: v.textValue ?? null,
            numberValue: v.numberValue ?? null,
            booleanValue: v.booleanValue ?? null,
          },
        });
      }
    }
  }
}
