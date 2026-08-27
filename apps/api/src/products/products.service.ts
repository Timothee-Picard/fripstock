import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { CurrentUser } from '../common/types/current-user';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatusesService } from '../statuses/statuses.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  normalizeValue,
  type ApplicableAttribute,
  type NormalizedValue,
} from './attributes.validation';
import { splitCost } from './lot-split';
import { consignmentReference, depositorCode, freeCode, resaleReference } from './references';
import type { AssignShopDto } from './dto/assign-shop.dto';
import type { CreateLotDto } from './dto/create-lot.dto';
import type { ChangeStatusDto } from './dto/change-status.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { FilterProductsDto } from './dto/filter-products.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateSaleDto } from './dto/update-sale.dto';
import type { ValueAttributeDto } from './dto/attribute-value.dto';
import { dateFr, frNumber, yesNo, toCsv } from './csv-export';

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
/**
 * Traduit une référence déjà prise en refus lisible.
 *
 * Sans ça, la contrainte d'unicité de la base remonte en « Internal server
 * error » : l'utilisateur a simplement saisi une référence qui existe, il doit
 * lire laquelle.
 */
async function onDuplicateReference<T>(
  reference: string | null,
  ecriture: () => Promise<T>,
): Promise<T> {
  try {
    return await ecriture();
  } catch (error) {
    if (isUniqueViolation(error, 'reference')) {
      throw new ConflictException(`La référence « ${reference ?? ''} » est déjà utilisée.`);
    }
    throw error;
  }
}

/**
 * Référence d'un exemplaire dans une ligne de lot.
 *
 * Un seul exemplaire garde la référence telle quelle ; plusieurs la suffixent,
 * sans quoi quatre t-shirts porteraient la même — et le gérant ne saurait plus
 * lequel il a en main.
 */
function reference(base: string | undefined, count: number, rang: number): string | undefined {
  if (!base) return undefined;
  return count > 1 ? `${base}-${rang + 1}` : base;
}

export async function shopOfProduct(
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

/**
 * Client Prisma, transactionnel ou non.
 *
 * Les validations et l'écriture d'un produit doivent pouvoir tourner dans une
 * transaction déjà ouverte : c'est ce qui permet de créer un contrat de dépôt
 * et ses articles en une passe, sans laisser un contrat orphelin derrière une
 * ligne refusée.
 */
type Db = PrismaService | Prisma.TransactionClient;

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
        yesNo(p.depositorPaid),
        ...dynamicHeaders.map((name) => attributes.get(name)?.join(', ') ?? ''),
      ];
    });

    return toCsv(headers, lines);
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
      ...(await this.shopRestriction(currentUser, filters)),
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
    const product = await this.prisma.$transaction((tx) => this.createWith(tx, currentUser, dto));
    return this.detail(currentUser, product.id);
  }

  /**
   * Crée un produit dans une transaction déjà ouverte.
   *
   * Exposé pour la création d'un contrat de dépôt avec ses articles : le
   * contrat et ses lignes sont écrits ensemble, ou pas du tout.
   */
  async createWith(tx: Prisma.TransactionClient, currentUser: CurrentUser, dto: CreateProductDto) {
    await this.requireCategory(tx, currentUser, dto.categoryId);
    if (dto.shopId) await this.requireShop(tx, currentUser, dto.shopId);

    const status = dto.statusId
      ? await this.requireStatus(tx, currentUser, dto.statusId)
      : await this.statuses.defaults(currentUser.companyId);

    const contract = await this.checkSaleType(tx, currentUser, dto.saleType, dto.depositContractId);
    const values = await this.normalizeAttributes(
      tx,
      currentUser,
      dto.categoryId,
      dto.attributes ?? [],
    );

    // Une référence saisie l'emporte : le gérant peut avoir son propre système,
    // et une étiquette déjà écrite ne se renumérote pas.
    const reference = dto.reference?.trim()
      ? dto.reference.trim()
      : await this.nextReference(tx, currentUser, dto.saleType, contract);

    const created = await onDuplicateReference(reference, () =>
      tx.product.create({
        data: {
          companyId: currentUser.companyId,
          shopId: dto.shopId ?? null,
          categoryId: dto.categoryId,
          statusId: status.id,
          name: dto.name,
          reference: reference,
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
      }),
    );

    await this.writeValues(tx, created.id, values);
    await tx.statusHistory.create({
      data: {
        productId: created.id,
        statusId: status.id,
        changedByUserId: currentUser.userId,
        note: 'Création du produit',
      },
    });
    return created;
  }

  /**
   * Achat en lot : un prix payé, plusieurs articles.
   *
   * Le lot est acheté, donc tout est créé en achat-revente. Le prix payé est
   * réparti au prorata des prix de vente (voir lot-split.ts) : chaque article
   * porte ainsi un prix d'achat cohérent, sans quoi la marge des statistiques
   * ne veut rien dire.
   *
   * Une ligne de plusieurs exemplaires donne autant de produits distincts, et
   * non un produit de quantité N : le statut porte sur la ligne entière, on ne
   * saurait pas en vendre un seul.
   *
   * Le tout dans une transaction — un lot à moitié créé serait un stock faux.
   */
  async createLot(currentUser: CurrentUser, dto: CreateLotDto) {
    // Chaque exemplaire devient un article à part entière avant le partage :
    // c'est bien entre les articles, et non entre les lignes, que le prix payé
    // doit se répartir.
    const articles = dto.lines.flatMap((ligne, index) => {
      // `count` décrit la ligne du lot, pas le produit : il est consommé ici,
      // et chaque exemplaire devient un article distinct de quantité 1.
      const { count = 1, ...produit } = ligne;
      return Array.from({ length: count }, (_, rang) => ({
        produit,
        index,
        reference: reference(produit.reference, count, rang),
      }));
    });

    // `null` et non zéro pour un prix de vente absent : la répartition doit
    // pouvoir distinguer « pas encore étiqueté » de « donné ».
    const parts = splitCost(
      dto.totalPurchasePrice,
      articles.map((a) => a.produit.salePrice ?? null),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const [rang, article] of articles.entries()) {
        try {
          const produit = await this.createWith(tx, currentUser, {
            ...article.produit,
            reference: article.reference,
            shopId: dto.shopId,
            saleType: 'RESALE',
            purchasePrice: parts[rang],
          });
          ids.push(produit.id);
        } catch (error) {
          // Sans le numéro de ligne, le message est inexploitable sur un lot
          // d'une vingtaine d'articles.
          throw new BadRequestException(
            `Ligne ${article.index + 1} (${article.produit.name}) : ${(error as Error).message}`,
          );
        }
      }
      return ids;
    });

    return {
      count: created.length,
      totalPurchasePrice: dto.totalPurchasePrice,
      productIds: created,
    };
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateProductDto) {
    const product = await this.loadForWrite(currentUser, id);

    const categoryId = dto.categoryId ?? product.categoryId;
    if (dto.categoryId) await this.requireCategory(this.prisma, currentUser, dto.categoryId);
    if (dto.shopId) await this.requireShop(this.prisma, currentUser, dto.shopId);

    const saleType = dto.saleType ?? product.saleType;
    // Le contrat existant n'est repris que si le produit reste en dépôt-vente :
    // sinon, basculer en achat-revente depuis le formulaire échouerait sur
    // « un produit en achat-revente n'est rattaché à aucun contrat », alors que
    // l'intention est justement de le détacher.
    const contract = await this.checkSaleType(
      this.prisma,
      currentUser,
      saleType,
      saleType === 'CONSIGNMENT'
        ? (dto.depositContractId ?? product.depositContractId ?? undefined)
        : dto.depositContractId,
    );

    // Changer de catégorie peut rendre des attributs inapplicables : on
    // revalide l'ensemble contre la catégorie finale.
    const values =
      dto.attributes !== undefined || dto.categoryId !== undefined
        ? await this.normalizeAttributes(
            this.prisma,
            currentUser,
            categoryId,
            dto.attributes ?? (await this.currentValues(id)),
          )
        : null;

    await this.prisma.$transaction(async (tx) => {
      await onDuplicateReference(dto.reference ?? null, () =>
        tx.product.update({
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
        }),
      );
      if (values) {
        await tx.attributeValue.deleteMany({ where: { productId: id } });
        await tx.productAttributeOption.deleteMany({ where: { productId: id } });
        await this.writeValues(tx, id, values);
      }
    });

    return this.detail(currentUser, id);
  }

  async assignShop(currentUser: CurrentUser, id: string, dto: AssignShopDto) {
    await this.loadForWrite(currentUser, id);
    if (dto.shopId) await this.requireShop(this.prisma, currentUser, dto.shopId);

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
    const current = await this.prisma.status.findUniqueOrThrow({ where: { id: product.statusId } });
    const target = await this.requireStatus(this.prisma, currentUser, dto.statusId);

    // Le flux de l'entreprise, s'il est défini, dit quelles transitions sont
    // permises. Les règles de flags s'appliquent par-dessus.
    await this.statuses.checkTransition(currentUser.companyId, current.id, target.id);

    // Un produit rendu ou retiré ne redevient jamais vendable.
    if (current.blocksSale && target.isSale) {
      throw new ForbiddenException(
        `Ce produit est « ${current.name} » : il ne peut plus être vendu.`,
      );
    }
    if (current.blocksSale && dto.soldPrice !== undefined) {
      throw new ForbiddenException(
        `Ce produit est « ${current.name} » : son prix vendu ne peut plus être modifié.`,
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
    return { deleted: true };
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Restriction de visibilité d'un employé : ses boutiques, plus le stock
   * central. Voir la règle « Produits non assignés » de CLAUDE.md.
   */
  private async shopRestriction(
    currentUser: CurrentUser,
    filters: FilterProductsDto,
  ): Promise<Prisma.ProductWhereInput> {
    if (filters.unassigned === 'true') return { shopId: null };
    if (filters.shopId) {
      await this.requireShop(this.prisma, currentUser, filters.shopId);
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

  /**
   * Référence suivante pour un article qu'on est en train de créer.
   *
   * Le compteur est incrémenté par la base, dans la transaction en cours : deux
   * employés qui enregistrent au même moment obtiennent deux numéros, là où un
   * `max + 1` lu puis réécrit leur donnerait le même.
   */
  private async nextReference(
    tx: Prisma.TransactionClient,
    currentUser: CurrentUser,
    saleType: 'RESALE' | 'CONSIGNMENT',
    contract: { depositorId: string } | null,
  ): Promise<string> {
    if (saleType === 'RESALE' || !contract) {
      const { productCounter } = await tx.company.update({
        where: { id: currentUser.companyId },
        data: { productCounter: { increment: 1 } },
        select: { productCounter: true },
      });
      return resaleReference(productCounter);
    }

    const depositor = await tx.depositor.findUniqueOrThrow({
      where: { id: contract.depositorId },
      select: { id: true, code: true, lastName: true, firstName: true },
    });
    const code = depositor.code ?? (await this.assignCode(tx, currentUser.companyId, depositor));

    const { productCounter } = await tx.depositor.update({
      where: { id: depositor.id },
      data: { productCounter: { increment: 1 } },
      select: { productCounter: true },
    });
    return consignmentReference(code, productCounter);
  }

  /**
   * Attribue son code à un déposant qui n'en a pas encore.
   *
   * Le cas se présente pour les déposants créés avant la génération de
   * références : plutôt qu'une migration qui devinerait des codes en masse, on
   * le calcule au premier article déposé, une fois pour toutes.
   */
  private async assignCode(
    tx: Prisma.TransactionClient,
    companyId: string,
    depositor: { id: string; lastName: string; firstName: string | null },
  ): Promise<string> {
    const autres = await tx.depositor.findMany({
      where: { companyId, code: { not: null } },
      select: { code: true },
    });
    const code = freeCode(
      depositorCode(depositor.lastName, depositor.firstName),
      new Set(autres.map((d) => d.code).filter((c): c is string => c !== null)),
    );
    await tx.depositor.update({ where: { id: depositor.id }, data: { code } });
    return code;
  }

  private async requireCategory(db: Db, currentUser: CurrentUser, id: string) {
    const c = await db.category.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!c) throw new BadRequestException("Cette catégorie n'appartient pas à votre entreprise.");
  }

  private async requireShop(db: Db, currentUser: CurrentUser, id: string) {
    const b = await db.shop.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!b) throw new BadRequestException("Cette boutique n'appartient pas à votre entreprise.");
  }

  private async requireStatus(db: Db, currentUser: CurrentUser, id: string) {
    const s = await db.status.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!s) throw new BadRequestException("Ce statut n'appartient pas à votre entreprise.");
    return s;
  }

  /** `CONSIGNMENT` exige un contrat ; `RESALE` en refuse un. */
  private async checkSaleType(
    db: Db,
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
    const contract = await db.depositContract.findFirst({
      // Pas de companyId sur DepositContract : le cloisonnement passe par le déposant.
      where: { id: depositContractId, depositor: { companyId: currentUser.companyId } },
      select: { id: true, depositorId: true },
    });
    if (!contract) {
      throw new BadRequestException("Ce contrat de dépôt n'appartient pas à votre entreprise.");
    }
    return contract;
  }

  /** Valide chaque valeur contre les attributs réellement applicables à la catégorie. */
  private async normalizeAttributes(
    db: Db,
    currentUser: CurrentUser,
    categoryId: string,
    values: ValueAttributeDto[],
  ): Promise<NormalizedValue[]> {
    if (values.length === 0) return [];

    const links = await db.categoryAttribute.findMany({
      where: { categoryId, attribute: { companyId: currentUser.companyId } },
      include: { attribute: { include: { options: { orderBy: { position: 'asc' } } } } },
    });
    const applicable = new Map<string, ApplicableAttribute>(
      links.map((l) => [l.attribute.id, l.attribute]),
    );

    const seen = new Set<string>();
    return values.map((v) => {
      const attribute = applicable.get(v.attributeDefinitionId);
      if (!attribute) {
        throw new BadRequestException(
          "Un attribut fourni ne s'applique pas à la catégorie choisie.",
        );
      }
      if (seen.has(attribute.id)) {
        throw new BadRequestException(`« ${attribute.name} » est renseigné deux fois.`);
      }
      seen.add(attribute.id);
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

  private async writeValues(
    tx: Prisma.TransactionClient,
    productId: string,
    values: NormalizedValue[],
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
