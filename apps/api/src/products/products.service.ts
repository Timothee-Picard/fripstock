import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import {
  isCompanyPermission,
  PERMISSION_LABELS,
  readPermissions,
  type Permission,
} from '../common/permissions';
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
import type { SellManyDto } from './dto/sell-many.dto';
import type { ChangeStatusDto } from './dto/change-status.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { FilterProductsDto, ProductSort } from './dto/filter-products.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateSaleDto } from './dto/update-sale.dto';
import type { UpdateOnlineDto } from './dto/update-online.dto';
import type { RemovalsDoneDto } from './dto/removals-done.dto';
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
        orderBy: this.orderBy(filters),
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
      orderBy: this.orderBy(filters),
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
      'En ligne',
      'Prix en ligne',
      'Retrait à faire',
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
        yesNo(p.isOnline),
        frNumber(p.onlinePrice?.toString() ?? null),
        yesNo(p.pendingRemoval),
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
  /**
   * Ordre de la liste, et donc de l'export : on exporte ce qu'on voit.
   *
   * Un second critère sur `id` ferme le tri : à valeurs égales — trois articles
   * au même prix — Postgres est libre de les rendre dans n'importe quel ordre,
   * et le même article pourrait apparaître sur deux pages ou sur aucune.
   */
  private orderBy(filters: FilterProductsDto): Prisma.ProductOrderByWithRelationInput[] {
    const sens: Prisma.SortOrder = filters.direction ?? (filters.sort ? 'asc' : 'desc');
    const colonnes: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
      createdAt: { createdAt: sens },
      reference: { reference: sens },
      name: { name: sens },
      salePrice: { salePrice: sens },
      soldPrice: { soldPrice: sens },
      soldAt: { soldAt: sens },
      // Par la position dans le flux, pas par le libellé : « En stock » avant
      // « Vendu » a un sens, l'ordre alphabétique n'en a aucun.
      status: { status: { position: sens } },
      category: { category: { name: sens } },
    };
    return [colonnes[filters.sort ?? 'createdAt'], { id: 'asc' }];
  }

  private async buildFilter(
    currentUser: CurrentUser,
    filters: FilterProductsDto,
  ): Promise<Prisma.ProductWhereInput> {
    return {
      companyId: currentUser.companyId,
      ...(await this.shopRestriction(currentUser, filters)),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      // Le déposant se rejoint par le contrat. Le scoping tient au `companyId`
      // du produit lui-même, posé juste au-dessus.
      ...(filters.depositorId ? { depositContract: { depositorId: filters.depositorId } } : {}),
      ...(filters.statusId ? { statusId: filters.statusId } : {}),
      ...(filters.saleType ? { saleType: filters.saleType } : {}),
      ...(filters.isOnline !== undefined ? { isOnline: filters.isOnline === 'true' } : {}),
      ...(filters.pendingRemoval === 'true' ? { pendingRemoval: true } : {}),
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
    await this.prisma.$transaction((tx) => this.changeStatusWith(tx, currentUser, product, dto));
    return this.detail(currentUser, id);
  }

  /**
   * Fait passer un produit à un autre statut, dans une transaction ouverte.
   *
   * Exposé pour la vente en lot au comptoir : cinq articles passent à vendu
   * ensemble, ou aucun. Un panier à moitié encaissé serait pire qu'un refus.
   */
  async changeStatusWith(
    tx: Prisma.TransactionClient,
    currentUser: CurrentUser,
    product: {
      id: string;
      statusId: string;
      saleType: string;
      depositContractId: string | null;
      shopId?: string | null;
      isOnline?: boolean;
    },
    dto: ChangeStatusDto,
  ) {
    const current = await tx.status.findUniqueOrThrow({ where: { id: product.statusId } });
    const target = await this.requireStatus(tx, currentUser, dto.statusId);

    await this.requireStatusRight(currentUser, product.shopId ?? null, target);

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
        const contract = await tx.depositContract.findUniqueOrThrow({
          where: { id: product.depositContractId },
          select: { commission: true },
        });
        saleData.appliedCommission = contract.commission;
      }
    }

    // Ce qu'il reste à faire de l'autre côté, et qui doit le faire, dépendent
    // du sens de la vente.
    //
    // **Vendu par le site** : celui qui enregistre la vente est celui qui tient
    // le site, l'annonce est donc traitée avec la commande — il ne reste que le
    // vêtement à aller décrocher, et seulement s'il est dans une boutique. Au
    // stock central il n'est sur aucun portant : rien à retirer.
    //
    // **Sorti du stock autrement** — vendu au comptoir, rendu, retiré — alors
    // que l'annonce est publiée : personne côté site n'est au courant. Elle
    // reste en ligne tant qu'on ne l'ôte pas, et l'annonce n'est surtout PAS
    // coupée ici : la couper effacerait la trace de ce qu'il reste à faire.
    const removal =
      target.leavesStock &&
      (target.isOnlineSale ? product.shopId != null : product.isOnline === true);

    await tx.product.update({
      where: { id: product.id },
      data: {
        status: { connect: { id: target.id } },
        ...saleData,
        ...(removal ? { pendingRemoval: true } : {}),
        // Vendu par le site : plus rien à annoncer, et rien à retenir non plus
        // puisque le site s'en occupe. Laisser le drapeau levé afficherait un
        // article vendu parmi les articles en ligne.
        ...(target.isOnlineSale && target.leavesStock ? { isOnline: false } : {}),
      },
    });
    await tx.statusHistory.create({
      data: {
        productId: product.id,
        statusId: target.id,
        changedByUserId: currentUser.userId,
        note: dto.note ?? null,
      },
    });
  }

  /**
   * Vente au comptoir : plusieurs articles passent à vendu d'un coup.
   *
   * Tout dans une transaction : un panier à moitié encaissé laisserait le
   * vendeur deviner ce qui est passé et ce qui ne l'est pas, client devant lui.
   * L'article fautif est nommé.
   */
  async sellMany(currentUser: CurrentUser, dto: SellManyDto) {
    const statusId = dto.statusId ?? (await this.saleStatus(currentUser)).id;
    const soldAt = dto.soldAt ?? new Date().toISOString();

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.lines.map((l) => l.productId) },
        companyId: currentUser.companyId,
      },
      select: {
        id: true,
        name: true,
        statusId: true,
        saleType: true,
        depositContractId: true,
        shopId: true,
        // Nécessaire au calcul du retrait à faire : un article vendu au
        // comptoir dont l'annonce est en ligne laisse une corvée derrière lui.
        isOnline: true,
      },
    });
    if (products.length !== dto.lines.length) {
      throw new BadRequestException("Un article cité n'appartient pas à votre entreprise.");
    }
    for (const produit of products) {
      await this.requireShopAccess(currentUser, produit.shopId);
    }

    const parId = new Map(products.map((p) => [p.id, p]));

    await this.prisma.$transaction(async (tx) => {
      for (const ligne of dto.lines) {
        const produit = parId.get(ligne.productId)!;
        try {
          await this.changeStatusWith(tx, currentUser, produit, {
            statusId,
            soldPrice: ligne.soldPrice,
            soldAt,
          });
        } catch (error) {
          throw new BadRequestException(`${produit.name} : ${(error as Error).message}`);
        }
      }
    });

    return {
      count: dto.lines.length,
      total: Math.round(dto.lines.reduce((t, l) => t + l.soldPrice, 0) * 100) / 100,
      soldAt,
    };
  }

  /**
   * Statut de vente **au comptoir** de l'entreprise.
   *
   * Ce sont les flags qui décident, jamais le libellé : le gérant peut renommer
   * ses statuts (voir CLAUDE.md). `isOnlineSale` est exclu — depuis qu'il
   * existe « Vendu en ligne », toute entreprise a deux statuts de vente, et
   * demander « précisez lequel » au comptoir sur un cas devenu normal
   * bloquerait chaque encaissement. Une vente en ligne se saisit depuis la
   * fiche, où le statut est choisi explicitement.
   */
  private async saleStatus(currentUser: CurrentUser) {
    const ventes = await this.prisma.status.findMany({
      where: { companyId: currentUser.companyId, isSale: true, isOnlineSale: false },
      select: { id: true, name: true },
    });
    if (ventes.length === 0) {
      throw new BadRequestException(
        "Aucun statut de vente au comptoir n'est défini pour cette entreprise.",
      );
    }
    if (ventes.length > 1) {
      throw new BadRequestException(
        `Plusieurs statuts de vente au comptoir existent (${ventes.map((s) => s.name).join(', ')}) : précisez lequel.`,
      );
    }
    return ventes[0];
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

  /**
   * Publie ou retire un article de la boutique en ligne, et fixe son prix web.
   *
   * `isOnline` est un drapeau sur le produit et non un statut : un vêtement sur
   * un portant peut être annoncé sur le site en même temps, alors qu'un produit
   * ne porte qu'un statut à la fois. Voir CLAUDE.md.
   */
  async setOnline(currentUser: CurrentUser, id: string, dto: UpdateOnlineDto) {
    const product = await this.loadForWrite(currentUser, id);
    const status = await this.prisma.status.findUniqueOrThrow({
      where: { id: product.statusId },
    });

    // Le flag décide, jamais le libellé : vendu, rendu ou retiré, l'article
    // n'est plus là — l'annoncer ferait vendre ce qu'on n'a plus.
    if (dto.isOnline === true && status.leavesStock) {
      throw new BadRequestException(
        `Ce produit est « ${status.name} » : il ne fait plus partie du stock et ne peut pas être mis en ligne.`,
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.isOnline !== undefined ? { isOnline: dto.isOnline } : {}),
        ...(dto.onlinePrice !== undefined ? { onlinePrice: dto.onlinePrice } : {}),
        // Dépublier à la main fait le travail que le retrait en attente
        // réclamait : la corvée n'a plus lieu d'être.
        ...(dto.isOnline === false ? { pendingRemoval: false } : {}),
      },
    });

    return this.detail(currentUser, id);
  }

  /**
   * « Retrait effectué » : l'article vendu a été ôté de l'autre canal.
   *
   * Une seule action pour les deux sens — dépublier l'annonce d'un article
   * vendu au comptoir, ou décrocher le vêtement d'un article vendu en ligne.
   * Le sens se lit sur le statut de vente (`isOnlineSale`) et n'est donc pas
   * stocké une seconde fois ; dans les deux cas l'annonce tombe, puisque
   * l'article n'existe plus nulle part.
   */
  async markRemovalDone(currentUser: CurrentUser, id: string) {
    const product = await this.loadForWrite(currentUser, id);
    if (!product.pendingRemoval) {
      throw new BadRequestException("Aucun retrait n'est en attente sur ce produit.");
    }

    await this.prisma.product.update({
      where: { id },
      data: { pendingRemoval: false, isOnline: false },
    });

    return this.detail(currentUser, id);
  }

  /**
   * « Retrait effectué » sur plusieurs articles d'un coup.
   *
   * Le geste réel est groupé — on dépublie douze annonces sur le site, puis on
   * revient dire que c'est fait — donc l'application doit l'être aussi : douze
   * clics pour une seule action est ce qui fait abandonner une liste de tâches.
   *
   * Tout dans une transaction : une confirmation à moitié passée laisserait
   * deviner ce qui a été soldé et ce qui reste, sans moyen de le savoir.
   */
  async markRemovalsDone(currentUser: CurrentUser, dto: RemovalsDoneDto) {
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.productIds },
        companyId: currentUser.companyId,
        // Silencieusement ignorés s'ils ne sont plus en attente : quelqu'un
        // d'autre a pu les solder entre l'affichage et le clic, et ce n'est pas
        // une erreur — c'est le travail fait.
        pendingRemoval: true,
      },
      select: { id: true, shopId: true },
    });

    for (const produit of products) {
      await this.requireShopAccess(currentUser, produit.shopId);
    }

    if (products.length === 0) return { count: 0 };

    await this.prisma.product.updateMany({
      where: { id: { in: products.map((p) => p.id) } },
      data: { pendingRemoval: false, isOnline: false },
    });

    return { count: products.length };
  }

  /**
   * Un utilisateur qui ne détient que `online.manage` ne peut viser que les
   * statuts de vente en ligne.
   *
   * Le garde de route ne peut pas s'en charger : il ne connaît pas le statut
   * visé, qui est dans le corps de la requête. Même partage que le `?shopId=`
   * du tableau de bord — la route ouvre, le service précise.
   */
  private async requireStatusRight(
    currentUser: CurrentUser,
    shopId: string | null,
    target: { isOnlineSale: boolean },
  ) {
    if (currentUser.isManager) return;
    if (await this.holds(currentUser, 'products.changeStatus', shopId)) return;
    if (target.isOnlineSale && (await this.holds(currentUser, 'online.manage', shopId))) return;

    throw new ForbiddenException(
      `Le droit « ${PERMISSION_LABELS['online.manage']} » ne permet que les ventes en ligne. ` +
        `Tout autre changement de statut demande « ${PERMISSION_LABELS['products.changeStatus']} ».`,
    );
  }

  /**
   * L'utilisateur détient-il ce droit sur cette boutique ?
   *
   * Même règle que le `PermissionsGuard` : un **droit d'entreprise** se cherche
   * partout — le site est unique, il n'y a pas de vente en ligne par boutique —
   * et le stock central aussi, puisqu'il n'appartient à aucune boutique.
   *
   * Le bypass gérant n'est **pas** refait ici : il appartient à l'appelant, une
   * seule fois, comme dans le garde. Le dupliquer donnerait deux endroits où
   * l'oublier le jour où la règle change.
   */
  private async holds(
    currentUser: CurrentUser,
    permission: Permission,
    shopId: string | null,
  ): Promise<boolean> {
    if (shopId === null || isCompanyPermission(permission)) {
      const compte = await this.prisma.shopAccess.count({
        where: {
          userId: currentUser.userId,
          shop: { companyId: currentUser.companyId },
          permissions: { path: [permission], equals: true },
        },
      });
      return compte > 0;
    }
    const access = await this.prisma.shopAccess.findFirst({
      where: { userId: currentUser.userId, shopId, shop: { companyId: currentUser.companyId } },
      select: { permissions: true },
    });
    return readPermissions(access?.permissions)[permission] === true;
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
   * Référence suivante pour un article qui entre en stock, ou qui change
   * d'origine.
   *
   * Le compteur est incrémenté par la base, dans la transaction en cours : deux
   * employés qui enregistrent au même moment obtiennent deux numéros, là où un
   * `max + 1` lu puis réécrit leur donnerait le même. Il n'est jamais rendu :
   * une référence libérée par une renumérotation ne sera pas réattribuée, ce
   * qui évite qu'une vieille étiquette désigne un jour un autre article.
   *
   * Exposé pour le rattachement à un contrat de dépôt, qui propose de
   * renuméroter l'article qu'il fait changer de camp.
   */
  async nextReference(
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
