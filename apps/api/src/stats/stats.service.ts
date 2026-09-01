import { BadRequestException, Injectable } from '@nestjs/common';
import { readPermissions, type Permission } from '../common/permissions';
import { removalScopes } from '../products/removal-scope';
import type { CurrentUser } from '../common/types/current-user';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dayBounds } from './today';
import type { PeriodDto } from './dto/period.dto';

const DEFAULT_DAYS = 30;

/** Une vente, avec le strict nécessaire au chiffre d'affaires et à la marge. */
interface SoldRow {
  id: string;
  name: string;
  reference: string | null;
  purchasePrice: unknown;
  soldPrice: unknown;
  appliedCommission: unknown;
  saleType: string;
  soldAt: Date | null;
  category: { id: string; name: string };
}

/** Une ligne de stock, vue par son statut. */
interface StockRow {
  quantity: number;
  salePrice: unknown;
  status: { id: string; name: string; color: string; leavesStock: boolean };
}

/**
 * Périmètre de chaque bloc du tableau de bord, ou `null` si le droit manque.
 *
 * `null` n'est pas « aucune boutique » : c'est « ce bloc n'existe pas pour cet
 * utilisateur ». La requête n'est alors même pas lancée.
 */
/**
 * Taille de l'**aperçu** des retraits sur le tableau de bord.
 *
 * Cinq, et pas davantage : l'écran ne montre que les derniers arrivés, et
 * ramener la liste entière alourdirait chaque chargement du tableau de bord
 * pour des lignes que personne n'y lit. Au-delà, on va sur l'écran des
 * retraits, qui est fait pour ça.
 *
 * Le total, lui, est compté à part : sans lui, cinq lignes se liraient comme
 * « il n'en reste que cinq ».
 */
const APERCU_RETRAITS = 5;

interface Scopes {
  sales: Prisma.ProductWhereInput | null;
  stock: Prisma.ProductWhereInput | null;
  till: Prisma.ProductWhereInput | null;
  /** Les annonces à retirer du site — voir `removalScopes`. */
  online: Prisma.ProductWhereInput | null;
  /**
   * La recette en ligne du jour. Pas croisé, lui : c'est un total, il ne dit
   * rien de ce qu'il y a en boutique.
   */
  onlineTill: Prisma.ProductWhereInput | null;
  /** Décrocher un vêtement du portant : `products.manage`. */
  shelf: Prisma.ProductWhereInput | null;
}

/**
 * Ce que la boutique garde réellement sur un article vendu.
 *
 * Sa marge en achat-revente, sa commission en dépôt-vente — où l'essentiel du
 * prix revient au déposant.
 */
function margeDe(p: {
  soldPrice: unknown;
  purchasePrice: unknown;
  appliedCommission: unknown;
  saleType: string;
}): number {
  const cashed = Number(p.soldPrice ?? 0);
  if (p.saleType === 'CONSIGNMENT') {
    return (cashed * Number(p.appliedCommission ?? 0)) / 100;
  }
  return cashed - Number(p.purchasePrice ?? 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Chiffre d'affaires, marge, courbe et classements. Réservé à `stats.view`. */
function salesBlock(sold: SoldRow[], from: Date) {
  const revenue = round(sold.reduce((total, p) => total + Number(p.soldPrice ?? 0), 0));
  const margin = round(sold.reduce((total, p) => total + margeDe(p), 0));

  const byDay = new Map<string, { revenue: number; count: number }>();
  for (const p of sold) {
    const day = (p.soldAt ?? from).toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { revenue: 0, count: 0 };
    entry.revenue += Number(p.soldPrice ?? 0);
    entry.count += 1;
    byDay.set(day, entry);
  }

  const byCategory = new Map<
    string,
    { id: string; name: string; revenue: number; count: number }
  >();
  for (const p of sold) {
    const entry = byCategory.get(p.category.id) ?? {
      id: p.category.id,
      name: p.category.name,
      revenue: 0,
      count: 0,
    };
    entry.revenue += Number(p.soldPrice ?? 0);
    entry.count += 1;
    byCategory.set(p.category.id, entry);
  }

  return {
    sales: {
      count: sold.length,
      revenue,
      margin,
      averageBasket: sold.length > 0 ? round(revenue / sold.length) : 0,
    },
    byDay: [...byDay.entries()]
      .map(([day, v]) => ({ day, revenue: round(v.revenue), count: v.count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    topCategories: [...byCategory.values()]
      .map((c) => ({ ...c, revenue: round(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    topProducts: sold
      .map((p) => ({
        id: p.id,
        name: p.name,
        reference: p.reference,
        revenue: round(Number(p.soldPrice ?? 0)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  };
}

/** État du stock : ce qu'il y a en boutique. Réservé à `stock.view`. */
function stockBlock(stock: StockRow[]) {
  const byStatus = new Map<
    string,
    { id: string; name: string; color: string; leavesStock: boolean; count: number; value: number }
  >();
  for (const p of stock) {
    const entry = byStatus.get(p.status.id) ?? { ...p.status, count: 0, value: 0 };
    entry.count += p.quantity;
    entry.value += Number(p.salePrice ?? 0) * p.quantity;
    byStatus.set(p.status.id, entry);
  }
  const statuses = [...byStatus.values()].map((s) => ({ ...s, value: round(s.value) }));
  const active = statuses.filter((s) => !s.leavesStock);

  return {
    stock: {
      byStatus: statuses.sort((a, b) => b.count - a.count),
      active: active.reduce((t, s) => t + s.count, 0),
      activeValue: round(active.reduce((t, s) => t + s.value, 0)),
    },
  };
}

/**
 * Taux de retour : réservé à `stats.view`, avec les autres chiffres de gestion.
 *
 * Il ne dit pas ce qu'il y a en boutique, mais si les dépôts qu'on accepte se
 * vendent — un jugement sur la sélection, du même ordre que la marge. Il n'a
 * rien à faire avec l'inventaire.
 */
function returnsBlock(consignment: { status: { blocksSale: boolean } }[]) {
  const returned = consignment.filter((p) => p.status.blocksSale).length;
  return {
    returns: {
      consignmentOverPeriod: consignment.length,
      returned,
      rate: consignment.length > 0 ? round((returned / consignment.length) * 100) : 0,
    },
  };
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Périmètre de chaque bloc, selon les droits de l'utilisateur.
   *
   * Les chiffres d'argent (`stats.view`) et l'état du stock (`stock.view`) sont
   * deux droits distincts : quelqu'un peut gérer le stock sans avoir à
   * connaître les marges de la boutique. Le comptoir (`products.changeStatus`)
   * ouvre en plus le seul total de la journée — c'est sa propre recette.
   *
   * Sans boutique précisée, un employé ne voit que celles où il détient le
   * droit : sans ce filtre, la permission accordée sur une boutique lui
   * livrerait les chiffres de toutes les autres. Le stock central y est joint,
   * comme partout (CLAUDE.md, « Produits non assignés »).
   *
   * Avec une boutique précisée, le droit doit être détenu **sur celle-là** : le
   * garde de route ne peut plus s'en charger, puisque l'accès à la page ne
   * dépend plus d'une permission unique.
   */
  private async scopes(currentUser: CurrentUser, shopId?: string): Promise<Scopes> {
    if (currentUser.isManager) {
      const where: Prisma.ProductWhereInput = shopId ? { shopId } : {};
      return {
        sales: where,
        stock: where,
        till: where,
        online: where,
        onlineTill: where,
        shelf: where,
      };
    }

    const accesses = await this.prisma.shopAccess.findMany({
      where: { userId: currentUser.userId, shop: { companyId: currentUser.companyId } },
      select: { shopId: true, permissions: true },
    });

    const scope = (permission: Permission): Prisma.ProductWhereInput | null => {
      const ids = accesses
        .filter((a) => readPermissions(a.permissions)[permission] === true)
        .map((a) => a.shopId);
      if (ids.length === 0) return null;
      if (shopId) return ids.includes(shopId) ? { shopId } : null;
      return { OR: [{ shopId: null }, { shopId: { in: ids } }] };
    };

    // Les deux périmètres de retrait viennent de `removalScopes` : la règle est
    // subtile — l'un porte sur toute l'entreprise, l'autre boutique par
    // boutique — et l'écran des retraits doit appliquer exactement la même.
    const retraits = await removalScopes(this.prisma, currentUser, shopId);
    const enLigne = retraits.delist !== null;

    return {
      sales: scope('stats.view'),
      stock: scope('stock.view'),
      till: scope('products.changeStatus'),
      online: retraits.delist,
      // La recette en ligne du jour n'est qu'un total : elle ne nomme aucun
      // article, donc gérer le site suffit.
      onlineTill: enLigne ? (shopId ? { shopId } : {}) : null,
      shelf: retraits.pull,
    };
  }

  /**
   * Aperçu des retraits : les plus récents d'abord, plus le compte réel.
   *
   * Le total ne se déduit pas de la longueur de la liste, qui est tronquée à
   * cinq. Le dire explicitement est ce qui distingue « il n'en reste que
   * cinq » de « on vous en montre cinq ».
   */
  private async removalList(where: Prisma.ProductWhereInput) {
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          reference: true,
          soldAt: true,
          shop: { select: { id: true, name: true } },
          status: { select: { id: true, name: true, color: true, isOnlineSale: true } },
        },
        orderBy: { soldAt: 'desc' },
        take: APERCU_RETRAITS,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Tableau de bord.
   *
   * Tous les agrégats se définissent par les **flags de `Status`**, jamais par
   * le libellé : le gérant peut renommer ses statuts, et un `name === 'Vendu'`
   * en dur casserait silencieusement les chiffres.
   *
   * - vendu       → statut `isSale`
   * - stock actif → statut `leavesStock = false`
   * - rendu       → statut `blocksSale`
   *
   * Les blocs auxquels l'utilisateur n'a pas droit sont **absents** de la
   * réponse. Les renvoyer pour que l'interface les masque laisserait la marge
   * de la boutique dans une réponse HTTP lisible par son destinataire.
   */
  async dashboard(currentUser: CurrentUser, filters: PeriodDto) {
    const to = filters.to ? new Date(filters.to) : new Date();
    const from = filters.from
      ? new Date(filters.from)
      : new Date(to.getTime() - DEFAULT_DAYS * 86400000);
    if (from > to) throw new BadRequestException('La date de début doit précéder la date de fin.');

    if (filters.shopId) {
      const shop = await this.prisma.shop.count({
        where: { id: filters.shopId, companyId: currentUser.companyId },
      });
      if (shop === 0) {
        throw new BadRequestException("Cette boutique n'appartient pas à votre entreprise.");
      }
    }

    const droits = await this.scopes(currentUser, filters.shopId);
    const company: Prisma.ProductWhereInput = { companyId: currentUser.companyId };

    // La boutique en ligne se regarde comme une boutique physique, mais ne se
    // filtre pas pareil.
    //
    // Une **vente** passée se reconnaît au flag de son statut, qui ne bouge
    // plus : `isOnlineSale`. Le **stock annoncé**, lui, est un état courant :
    // `isOnline`. Confondre les deux fausserait l'histoire — l'annonce tombe
    // quand le retrait est confirmé, et les ventes d'hier disparaîtraient des
    // chiffres au fur et à mesure qu'on fait le ménage.
    const enLigne = filters.channel === 'online';
    const stockDuCanal: Prisma.ProductWhereInput = enLigne ? { isOnline: true } : {};

    // La journée en cours, indépendante de la période choisie : c'est la
    // question qu'on se pose en fermant la boutique.
    const jour = dayBounds();

    // Le total du jour suit les chiffres de vente quand l'employé y a droit ;
    // à défaut, tenir la caisse suffit à voir sa propre recette — mais sans la
    // marge, qui révélerait les prix d'achat.
    // Sur la boutique en ligne, gérer le site vaut tenir la caisse : c'est sa
    // propre recette du jour, au même titre que celle du comptoir.
    const todayScope = droits.sales ?? droits.till ?? (enLigne ? droits.onlineTill : null);

    // Les retraits à faire, chacun pour la main dont c'est le travail. Le
    // droit ne décide pas seulement si on voit la liste, mais **laquelle** :
    // l'annonce à dépublier revient à qui gère le site, le vêtement à
    // décrocher à qui tient la boutique. Un seul droit ne montre qu'une moitié.
    // …et l'endroit regardé décide **laquelle des deux** on montre : sur la
    // boutique en ligne, les annonces à dépublier ; sur une boutique physique,
    // les vêtements à décrocher qui s'y trouvent encore. Sans sélection, les
    // deux. Montrer l'autre liste à un endroit où elle ne se traite pas ferait
    // apparaître une corvée que personne n'y ferait.
    const concerne = (isOnlineSale: boolean) =>
      enLigne ? !isOnlineSale : !filters.shopId || isOnlineSale;

    const removalScope = (
      scope: Prisma.ProductWhereInput | null,
      isOnlineSale: boolean,
    ): Prisma.ProductWhereInput | false =>
      scope !== null &&
      concerne(isOnlineSale) && {
        ...company,
        ...scope,
        pendingRemoval: true,
        // Le sens se lit sur le flag du statut de vente, jamais sur son libellé.
        status: { isOnlineSale },
      };

    const [sold, stock, consignmentPeriod, today, toDelist, toPull] = await Promise.all([
      // Les produits vendus sur la période. Le volume est celui des ventes
      // d'une boutique : on agrège en mémoire plutôt que d'empiler cinq
      // requêtes d'agrégation.
      droits.sales &&
        this.prisma.product.findMany({
          where: {
            ...company,
            ...droits.sales,
            status: { isSale: true, ...(enLigne ? { isOnlineSale: true } : {}) },
            soldAt: { gte: from, lte: to },
          },
          select: {
            id: true,
            name: true,
            reference: true,
            purchasePrice: true,
            soldPrice: true,
            appliedCommission: true,
            saleType: true,
            soldAt: true,
            category: { select: { id: true, name: true } },
          },
        }),
      droits.stock &&
        this.prisma.product.findMany({
          where: { ...company, ...droits.stock, ...stockDuCanal },
          select: {
            quantity: true,
            salePrice: true,
            status: { select: { id: true, name: true, color: true, leavesStock: true } },
          },
        }),
      // Taux de retour : parmi les articles en dépôt-vente créés sur la période,
      // ceux qui ont fini dans un statut bloquant (rendu, retiré).
      //
      // Volontairement **absent quand on regarde un canal** : il dit si les
      // dépôts qu'on accepte se vendent, pas où ils se vendent. Un article
      // rendu n'a été vendu nulle part, donc le filtrer par canal donnerait
      // toujours zéro — un chiffre faux vaut moins que pas de chiffre.
      !enLigne &&
        droits.sales &&
        this.prisma.product.findMany({
          where: {
            ...company,
            ...droits.sales,
            saleType: 'CONSIGNMENT',
            createdAt: { gte: from, lte: to },
          },
          select: { status: { select: { blocksSale: true } } },
        }),
      todayScope &&
        this.prisma.product.findMany({
          where: {
            ...company,
            ...todayScope,
            status: { isSale: true, ...(enLigne ? { isOnlineSale: true } : {}) },
            soldAt: { gte: jour.from, lte: jour.to },
          },
          select: { purchasePrice: true, soldPrice: true, appliedCommission: true, saleType: true },
        }),
      // Vendus au comptoir, annonce encore publiée : à dépublier.
      removalScope(droits.online, false) &&
        this.removalList(removalScope(droits.online, false) as Prisma.ProductWhereInput),
      // Vendus par le site, vêtement encore en boutique : à décrocher.
      removalScope(droits.shelf, true) &&
        this.removalList(removalScope(droits.shelf, true) as Prisma.ProductWhereInput),
    ]);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      ...(today
        ? {
            today: {
              // Le jour calendaire, pas l'instant : le serveur Next tourne
              // en UTC et reformaterait minuit à Paris en la veille.
              date: jour.day,
              count: today.length,
              revenue: round(today.reduce((t, p) => t + Number(p.soldPrice ?? 0), 0)),
              ...(droits.sales ? { margin: round(today.reduce((t, p) => t + margeDe(p), 0)) } : {}),
            },
          }
        : {}),
      ...(sold ? salesBlock(sold, from) : {}),
      ...(consignmentPeriod ? returnsBlock(consignmentPeriod) : {}),
      ...(stock ? stockBlock(stock) : {}),
      // Deux listes séparées et non une seule : ce ne sont pas les mêmes
      // gestes, ni les mêmes personnes. Un bloc absent est un droit qui
      // manque — on ne renvoie jamais une liste vide « pour que l'écran la
      // masque », la réponse est lisible par son destinataire.
      ...(toDelist || toPull
        ? {
            removals: {
              ...(toDelist ? { toDelist } : {}),
              ...(toPull ? { toPull } : {}),
            },
          }
        : {}),
    };
  }
}
