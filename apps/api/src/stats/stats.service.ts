import { BadRequestException, Injectable } from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PeriodDto } from './dto/period.dto';

const DEFAULT_DAYS = 30;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const base: Prisma.ProductWhereInput = {
      companyId: currentUser.companyId,
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
    };

    const [sold, stock, consignmentPeriod] = await Promise.all([
      // Les produits vendus sur la période, avec ce qu'il faut pour le CA et la
      // marge. Le volume est celui des ventes d'une boutique : on agrège en
      // mémoire plutôt que d'empiler cinq requêtes d'agrégation.
      this.prisma.product.findMany({
        where: { ...base, status: { isSale: true }, soldAt: { gte: from, lte: to } },
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
      this.prisma.product.findMany({
        where: base,
        select: {
          quantity: true,
          salePrice: true,
          status: { select: { id: true, name: true, color: true, leavesStock: true } },
        },
      }),
      // Taux de retour : parmi les articles en dépôt-vente créés sur la période,
      // ceux qui ont fini dans un statut bloquant (rendu, retiré).
      this.prisma.product.findMany({
        where: { ...base, saleType: 'CONSIGNMENT', createdAt: { gte: from, lte: to } },
        select: { status: { select: { blocksSale: true } } },
      }),
    ]);

    // --- Ventes -------------------------------------------------------------
    const revenue = round(sold.reduce((total, p) => total + Number(p.soldPrice ?? 0), 0));

    // Ce que la boutique garde réellement : sa marge en achat-revente, sa
    // commission en dépôt-vente — où l'essentiel du prix revient au déposant.
    const margin = round(
      sold.reduce((total, p) => {
        const encaisse = Number(p.soldPrice ?? 0);
        if (p.saleType === 'CONSIGNMENT') {
          return total + (encaisse * Number(p.appliedCommission ?? 0)) / 100;
        }
        return total + (encaisse - Number(p.purchasePrice ?? 0));
      }, 0),
    );

    // --- Ventes par jour, pour la courbe ------------------------------------
    const byDay = new Map<string, { revenue: number; count: number }>();
    for (const p of sold) {
      const day = (p.soldAt ?? from).toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { revenue: 0, count: 0 };
      entry.revenue += Number(p.soldPrice ?? 0);
      entry.count += 1;
      byDay.set(day, entry);
    }

    // --- Classements --------------------------------------------------------
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

    // --- Stock --------------------------------------------------------------
    const byStatus = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        leavesStock: boolean;
        count: number;
        value: number;
      }
    >();
    for (const p of stock) {
      const entry = byStatus.get(p.status.id) ?? { ...p.status, count: 0, value: 0 };
      entry.count += p.quantity;
      entry.value += Number(p.salePrice ?? 0) * p.quantity;
      byStatus.set(p.status.id, entry);
    }
    const statuses = [...byStatus.values()].map((s) => ({ ...s, value: round(s.value) }));
    const active = statuses.filter((s) => !s.leavesStock);

    // --- Retours ------------------------------------------------------------
    const returned = consignmentPeriod.filter((p) => p.status.blocksSale).length;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
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
      stock: {
        byStatus: statuses.sort((a, b) => b.count - a.count),
        active: active.reduce((t, s) => t + s.count, 0),
        activeValue: round(active.reduce((t, s) => t + s.value, 0)),
      },
      returns: {
        consignmentOverPeriod: consignmentPeriod.length,
        returned,
        rate: consignmentPeriod.length > 0 ? round((returned / consignmentPeriod.length) * 100) : 0,
      },
    };
  }
}
