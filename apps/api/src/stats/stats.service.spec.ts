import { BadRequestException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, SHOP_ID, employee, manager } from '../test/fixtures';

const vendu = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'p1',
  name: 'Sac',
  reference: 'R1',
  purchasePrice: '10',
  soldPrice: '50',
  appliedCommission: null,
  saleType: 'RESALE',
  soldAt: new Date('2026-08-10T12:00:00.000Z'),
  category: { id: 'c1', name: 'Sac' },
  ...over,
});

const enStock = (over: Partial<Record<string, unknown>> = {}) => ({
  quantity: 1,
  salePrice: '20',
  status: { id: 's1', name: 'En stock', color: '#111', leavesStock: false },
  ...over,
});

describe('StatsService', () => {
  let prisma: PrismaMock;
  let service: StatsService;

  /** Les quatre requêtes du tableau de bord, dans l'ordre du Promise.all. */
  function arrange(
    sold: unknown[],
    stock: unknown[],
    consignment: unknown[] = [],
    today: unknown[] = [],
  ) {
    prisma.product.findMany
      .mockResolvedValueOnce(sold)
      .mockResolvedValueOnce(stock)
      .mockResolvedValueOnce(consignment)
      .mockResolvedValueOnce(today);
  }

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StatsService(asPrisma(prisma));
  });

  describe('période', () => {
    it('remonte 30 jours en arrière par défaut', async () => {
      arrange([], []);
      const { period } = await service.dashboard(manager, {});
      const jours = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86400000;
      expect(Math.round(jours)).toBe(30);
    });

    it('respecte les bornes fournies', async () => {
      arrange([], []);
      const { period } = await service.dashboard(manager, {
        from: '2026-01-01',
        to: '2026-02-01',
      });
      expect(period.from).toBe(new Date('2026-01-01').toISOString());
      expect(period.to).toBe(new Date('2026-02-01').toISOString());
    });

    it('refuse un début postérieur à la fin', async () => {
      await expect(
        service.dashboard(manager, { from: '2026-02-01', to: '2026-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('portée par boutique', () => {
    it('ne filtre pas pour un gérant : il voit toute son entreprise', async () => {
      arrange([], []);
      await service.dashboard(manager, {});
      expect(prisma.product.findMany.mock.calls[1][0].where).toEqual({ companyId: COMPANY_ID });
      expect(prisma.shopAccess.findMany).not.toHaveBeenCalled();
    });

    it("limite l'employé aux boutiques où il a stats.view", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([
        { shopId: 'b1', permissions: { 'products.view': true } },
        { shopId: 'b2', permissions: { 'stats.view': true } },
      ]);
      arrange([], []);
      await service.dashboard(employee, {});
      // b1 est écartée : il y travaille, mais n'a pas le droit d'en voir les
      // chiffres. Sans ce filtre, une permission sur b2 livrait tout.
      expect(prisma.product.findMany.mock.calls[1][0].where).toEqual({
        companyId: COMPANY_ID,
        OR: [{ shopId: null }, { shopId: { in: ['b2'] } }],
      });
    });

    it('laisse le stock central visible, il n’est à aucune boutique', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([]);
      arrange([], []);
      await service.dashboard(employee, {});
      const where = prisma.product.findMany.mock.calls[1][0].where as {
        OR: { shopId: unknown }[];
      };
      expect(where.OR[0]).toEqual({ shopId: null });
      expect(where.OR[1]).toEqual({ shopId: { in: [] } });
    });

    it('applique la même restriction aux quatre requêtes', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([
        { shopId: 'b2', permissions: { 'stats.view': true } },
      ]);
      arrange([], []);
      await service.dashboard(employee, {});
      for (const appel of prisma.product.findMany.mock.calls) {
        expect(appel[0].where.OR).toEqual([{ shopId: null }, { shopId: { in: ['b2'] } }]);
      }
    });
  });

  describe('filtre boutique', () => {
    it("refuse une boutique d'une autre entreprise", async () => {
      prisma.shop.count.mockResolvedValue(0);
      await expect(service.dashboard(manager, { shopId: 'pirate' })).rejects.toThrow(
        "n'appartient pas à votre entreprise",
      );
    });

    it('restreint les agrégats à la boutique demandée', async () => {
      prisma.shop.count.mockResolvedValue(1);
      arrange([], []);
      await service.dashboard(manager, { shopId: SHOP_ID });
      expect(prisma.product.findMany.mock.calls[1][0].where).toEqual({
        companyId: COMPANY_ID,
        shopId: SHOP_ID,
      });
    });
  });

  describe('ventes', () => {
    it('additionne le chiffre d’affaires et le nombre de ventes', async () => {
      arrange([vendu(), vendu({ id: 'p2', soldPrice: '30' })], []);
      const { sales } = await service.dashboard(manager, {});
      expect(sales.count).toBe(2);
      expect(sales.revenue).toBe(80);
      expect(sales.averageBasket).toBe(40);
    });

    it('évite la division par zéro quand rien n’est vendu', async () => {
      arrange([], []);
      const { sales } = await service.dashboard(manager, {});
      expect(sales).toEqual({ count: 0, revenue: 0, margin: 0, averageBasket: 0 });
    });

    it('en achat-revente, la marge est le prix vendu moins le prix d’achat', async () => {
      arrange([vendu({ soldPrice: '50', purchasePrice: '10' })], []);
      const { sales } = await service.dashboard(manager, {});
      expect(sales.margin).toBe(40);
    });

    it('en dépôt-vente, la marge est la seule commission', async () => {
      arrange([vendu({ saleType: 'CONSIGNMENT', soldPrice: '100', appliedCommission: '40' })], []);
      const { sales } = await service.dashboard(manager, {});
      expect(sales.margin).toBe(40);
    });

    it('ne compte que les statuts porteurs de isSale', async () => {
      arrange([], []);
      await service.dashboard(manager, {});
      expect(prisma.product.findMany.mock.calls[0][0].where.status).toEqual({ isSale: true });
    });
  });

  describe('courbe et classements', () => {
    it('regroupe les ventes par jour', async () => {
      arrange(
        [
          vendu({ soldAt: new Date('2026-08-10T09:00:00.000Z'), soldPrice: '10' }),
          vendu({ id: 'p2', soldAt: new Date('2026-08-10T18:00:00.000Z'), soldPrice: '20' }),
          vendu({ id: 'p3', soldAt: new Date('2026-08-11T09:00:00.000Z'), soldPrice: '5' }),
        ],
        [],
      );
      const { byDay } = await service.dashboard(manager, {});
      expect(byDay).toEqual([
        { day: '2026-08-10', revenue: 30, count: 2 },
        { day: '2026-08-11', revenue: 5, count: 1 },
      ]);
    });

    it('classe les catégories par chiffre d’affaires décroissant', async () => {
      arrange(
        [
          vendu({ category: { id: 'c1', name: 'Sac' }, soldPrice: '10' }),
          vendu({ id: 'p2', category: { id: 'c2', name: 'Robe' }, soldPrice: '90' }),
        ],
        [],
      );
      const { topCategories } = await service.dashboard(manager, {});
      expect(topCategories.map((c) => c.name)).toEqual(['Robe', 'Sac']);
    });

    it('ne garde que les cinq meilleures ventes', async () => {
      arrange(
        Array.from({ length: 7 }, (_, i) => vendu({ id: `p${i}`, soldPrice: String(i) })),
        [],
      );
      const { topProducts } = await service.dashboard(manager, {});
      expect(topProducts).toHaveLength(5);
      expect(topProducts[0].revenue).toBe(6);
    });
  });

  describe('stock', () => {
    it('regroupe par statut en tenant compte des quantités', async () => {
      arrange(
        [],
        [enStock({ quantity: 2, salePrice: '10' }), enStock({ quantity: 1, salePrice: '5' })],
      );
      const { stock } = await service.dashboard(manager, {});
      expect(stock.byStatus[0].count).toBe(3);
      expect(stock.byStatus[0].value).toBe(25);
    });

    it('exclut du stock actif les statuts qui en font sortir', async () => {
      arrange(
        [],
        [
          enStock(),
          enStock({
            status: { id: 's2', name: 'Vendu', color: '#000', leavesStock: true },
            quantity: 5,
            salePrice: '100',
          }),
        ],
      );
      const { stock } = await service.dashboard(manager, {});
      expect(stock.active).toBe(1);
      expect(stock.activeValue).toBe(20);
      // Le statut sortant reste listé, il n'est simplement pas compté comme actif.
      expect(stock.byStatus).toHaveLength(2);
    });

    it('traite un prix de vente absent comme zéro', async () => {
      arrange([], [enStock({ salePrice: null })]);
      const { stock } = await service.dashboard(manager, {});
      expect(stock.activeValue).toBe(0);
    });
  });

  describe('journée en cours', () => {
    it('compte les ventes du jour, indépendamment de la période choisie', async () => {
      arrange([], [], [], [vendu(), vendu({ id: 'p2', soldPrice: '30' })]);
      const { today } = await service.dashboard(manager, { from: '2020-01-01' });
      expect(today.count).toBe(2);
      expect(today.revenue).toBe(80);
    });

    it('calcule la marge du jour comme celle de la période', async () => {
      arrange([], [], [], [vendu({ soldPrice: '50', purchasePrice: '10' })]);
      const { today } = await service.dashboard(manager, {});
      expect(today.margin).toBe(40);
    });

    it('ne retient que la commission sur un dépôt-vente', async () => {
      arrange(
        [],
        [],
        [],
        [vendu({ saleType: 'CONSIGNMENT', soldPrice: '100', appliedCommission: '40' })],
      );
      const { today } = await service.dashboard(manager, {});
      expect(today.margin).toBe(40);
    });

    it('rend une journée à zéro plutôt que rien', async () => {
      arrange([], []);
      const { today } = await service.dashboard(manager, {});
      expect(today).toMatchObject({ count: 0, revenue: 0, margin: 0 });
      expect(today.date).toEqual(expect.any(String));
    });

    it('borne la requête sur la journée, et non sur la période', async () => {
      arrange([], []);
      await service.dashboard(manager, { from: '2020-01-01', to: '2030-01-01' });
      const bornes = prisma.product.findMany.mock.calls[3][0].where.soldAt as {
        gte: Date;
        lte: Date;
      };
      // Vingt-quatre heures, quand la période en couvre dix ans.
      expect(bornes.lte.getTime() - bornes.gte.getTime()).toBe(86400000 - 1);
    });

    it('respecte le filtre boutique', async () => {
      prisma.shop.count.mockResolvedValue(1);
      arrange([], []);
      await service.dashboard(manager, { shopId: SHOP_ID });
      expect(prisma.product.findMany.mock.calls[3][0].where.shopId).toBe(SHOP_ID);
    });
  });

  describe('retours', () => {
    it('calcule le taux de retour sur les dépôts de la période', async () => {
      arrange(
        [],
        [],
        [
          { status: { blocksSale: true } },
          { status: { blocksSale: false } },
          { status: { blocksSale: false } },
          { status: { blocksSale: false } },
        ],
      );
      const { returns } = await service.dashboard(manager, {});
      expect(returns).toEqual({ consignmentOverPeriod: 4, returned: 1, rate: 25 });
    });

    it('rend un taux nul quand aucun dépôt n’a été créé', async () => {
      arrange([], [], []);
      const { returns } = await service.dashboard(manager, {});
      expect(returns).toEqual({ consignmentOverPeriod: 0, returned: 0, rate: 0 });
    });
  });
});
