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

  /**
   * Résultats des requêtes du tableau de bord, dans leur ordre d'appel.
   *
   * Volontairement positionnel et non nommé : elles ne sont pas toutes
   * lancées — un bloc auquel l'utilisateur n'a pas droit n'en déclenche
   * aucune, et décale donc les suivantes. Le reste répond vide.
   */
  function arrange(...resultats: unknown[][]) {
    for (const resultat of resultats) prisma.product.findMany.mockResolvedValueOnce(resultat);
    prisma.product.findMany.mockResolvedValue([]);
  }

  /**
   * Tableau de bord d'un gérant, tous blocs présents.
   *
   * Depuis que chaque bloc dépend d'un droit, le type les déclare optionnels.
   * Le gérant les a tous : on le vérifie une fois ici, plutôt que de parsemer
   * les tests d'assertions non nulles qui masqueraient une vraie disparition.
   */
  async function complet(filters: Parameters<StatsService['dashboard']>[1] = {}) {
    const d = await service.dashboard(manager, filters);
    const manquants = [
      'sales',
      'byDay',
      'topCategories',
      'topProducts',
      'stock',
      'returns',
      'today',
    ].filter((cle) => !(cle in d));
    if (manquants.length > 0) {
      throw new Error(`blocs absents pour un gérant : ${manquants.join(', ')}`);
    }
    return d as Required<typeof d>;
  }

  /** Droits d'un employé sur une boutique, tels que lus dans `ShopAccess`. */
  const acces = (shopId: string, ...permissions: string[]) => ({
    shopId,
    permissions: Object.fromEntries(permissions.map((cle) => [cle, true])),
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StatsService(asPrisma(prisma));
  });

  describe('période', () => {
    it('remonte 30 jours en arrière par défaut', async () => {
      arrange([], []);
      const { period } = await complet();
      const jours = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86400000;
      expect(Math.round(jours)).toBe(30);
    });

    it('respecte les bornes fournies', async () => {
      arrange([], []);
      const { period } = await complet({ from: '2026-01-01', to: '2026-02-01' });
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
      await complet();
      expect(prisma.product.findMany.mock.calls[1][0].where).toEqual({ companyId: COMPANY_ID });
      expect(prisma.shopAccess.findMany).not.toHaveBeenCalled();
    });

    it("limite l'employé aux boutiques où il détient le droit", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([
        acces('b1', 'products.view'),
        acces('b2', 'stats.view', 'stock.view'),
      ]);
      arrange([], []);
      await service.dashboard(employee, {});
      // b1 est écartée : il y travaille, mais n'a pas le droit d'en voir les
      // chiffres. Sans ce filtre, une permission sur b2 livrait tout.
      expect(prisma.product.findMany.mock.calls[0][0].where.OR).toEqual([
        { shopId: null },
        { shopId: { in: ['b2'] } },
      ]);
    });

    it('joint le stock central, qui n’est à aucune boutique', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'stock.view')]);
      arrange([]);
      await service.dashboard(employee, {});
      expect(prisma.product.findMany.mock.calls[0][0].where.OR[0]).toEqual({ shopId: null });
    });

    it('applique la même restriction à toutes les requêtes', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([
        acces('b2', 'stats.view', 'stock.view', 'products.changeStatus'),
      ]);
      arrange([], []);
      await service.dashboard(employee, {});
      expect(prisma.product.findMany).toHaveBeenCalledTimes(4);
      for (const appel of prisma.product.findMany.mock.calls) {
        expect(appel[0].where.OR).toEqual([{ shopId: null }, { shopId: { in: ['b2'] } }]);
      }
    });
  });

  describe('droits sur les blocs', () => {
    it('donne tout au gérant', async () => {
      arrange([], []);
      await expect(complet()).resolves.toBeDefined();
    });

    it("ne renvoie que l'état du stock à qui n'a que stock.view", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'stock.view')]);
      arrange([], []);
      const d = await service.dashboard(employee, {});
      expect(d.stock).toBeDefined();
      // Le chiffre d'affaires n'est pas masqué par l'interface : il n'est
      // jamais calculé, donc jamais dans la réponse.
      expect(d.sales).toBeUndefined();
      expect(d.today).toBeUndefined();
      // Le taux de retour juge la sélection des dépôts, pas l'inventaire.
      expect(d.returns).toBeUndefined();
    });

    it("ne renvoie que les chiffres de vente à qui n'a que stats.view", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'stats.view')]);
      arrange([], []);
      const d = await service.dashboard(employee, {});
      expect(d.sales).toBeDefined();
      expect(d.returns).toBeDefined();
      expect(d.stock).toBeUndefined();
    });

    it('ouvre la recette du jour à qui tient le comptoir, sans la marge', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'products.changeStatus')]);
      arrange([vendu({ soldPrice: '50', purchasePrice: '10' })]);
      const d = await service.dashboard(employee, {});
      expect(d.today).toMatchObject({ count: 1, revenue: 50 });
      // La marge dirait le prix d'achat : elle reste au gérant.
      expect(d.today && 'margin' in d.today).toBe(false);
      expect(d.sales).toBeUndefined();
    });

    it('donne la marge du jour dès que stats.view est détenu', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'stats.view')]);
      arrange([], [], [vendu({ soldPrice: '50', purchasePrice: '10' })]);
      const d = await service.dashboard(employee, {});
      expect(d.today?.margin).toBe(40);
    });

    it('ne renvoie que la période à qui n’a aucun de ces droits', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'products.view')]);
      const d = await service.dashboard(employee, {});
      expect(Object.keys(d)).toEqual(['period']);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('exige le droit sur la boutique demandée, pas seulement ailleurs', async () => {
      prisma.shop.count.mockResolvedValue(1);
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'stats.view')]);
      const d = await service.dashboard(employee, { shopId: 'b3' });
      // Il a bien stats.view — mais sur b2. Demander b3 ne doit rien ouvrir.
      expect(d.sales).toBeUndefined();
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
      const { sales } = await complet();
      expect(sales.count).toBe(2);
      expect(sales.revenue).toBe(80);
      expect(sales.averageBasket).toBe(40);
    });

    it('évite la division par zéro quand rien n’est vendu', async () => {
      arrange([], []);
      const { sales } = await complet();
      expect(sales).toEqual({ count: 0, revenue: 0, margin: 0, averageBasket: 0 });
    });

    it('en achat-revente, la marge est le prix vendu moins le prix d’achat', async () => {
      arrange([vendu({ soldPrice: '50', purchasePrice: '10' })], []);
      const { sales } = await complet();
      expect(sales.margin).toBe(40);
    });

    it('en dépôt-vente, la marge est la seule commission', async () => {
      arrange([vendu({ saleType: 'CONSIGNMENT', soldPrice: '100', appliedCommission: '40' })], []);
      const { sales } = await complet();
      expect(sales.margin).toBe(40);
    });

    it('ne compte que les statuts porteurs de isSale', async () => {
      arrange([], []);
      await complet();
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
      const { byDay } = await complet();
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
      const { topCategories } = await complet();
      expect(topCategories.map((c) => c.name)).toEqual(['Robe', 'Sac']);
    });

    it('ne garde que les cinq meilleures ventes', async () => {
      arrange(
        Array.from({ length: 7 }, (_, i) => vendu({ id: `p${i}`, soldPrice: String(i) })),
        [],
      );
      const { topProducts } = await complet();
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
      const { stock } = await complet();
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
      const { stock } = await complet();
      expect(stock.active).toBe(1);
      expect(stock.activeValue).toBe(20);
      // Le statut sortant reste listé, il n'est simplement pas compté comme actif.
      expect(stock.byStatus).toHaveLength(2);
    });

    it('traite un prix de vente absent comme zéro', async () => {
      arrange([], [enStock({ salePrice: null })]);
      const { stock } = await complet();
      expect(stock.activeValue).toBe(0);
    });
  });

  describe('journée en cours', () => {
    it('compte les ventes du jour, indépendamment de la période choisie', async () => {
      arrange([], [], [], [vendu(), vendu({ id: 'p2', soldPrice: '30' })]);
      const { today } = await complet({ from: '2020-01-01' });
      expect(today.count).toBe(2);
      expect(today.revenue).toBe(80);
    });

    it('calcule la marge du jour comme celle de la période', async () => {
      arrange([], [], [], [vendu({ soldPrice: '50', purchasePrice: '10' })]);
      const { today } = await complet();
      expect(today.margin).toBe(40);
    });

    it('ne retient que la commission sur un dépôt-vente', async () => {
      arrange(
        [],
        [],
        [],
        [vendu({ saleType: 'CONSIGNMENT', soldPrice: '100', appliedCommission: '40' })],
      );
      const { today } = await complet();
      expect(today.margin).toBe(40);
    });

    it('rend une journée à zéro plutôt que rien', async () => {
      arrange([], []);
      const { today } = await complet();
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

  describe('boutique en ligne', () => {
    it('ne compte que les ventes passées par le site', async () => {
      arrange([], []);
      await service.dashboard(manager, { channel: 'online' });
      expect(prisma.product.findMany.mock.calls[0][0].where.status).toEqual({
        isSale: true,
        isOnlineSale: true,
      });
    });

    it('reconnaît une vente à son statut, pas à l’annonce du moment', async () => {
      // L'annonce tombe quand le retrait est confirmé : filtrer le passé sur
      // `isOnline` ferait disparaître les ventes d'hier au fil du ménage.
      arrange([], []);
      await service.dashboard(manager, { channel: 'online' });
      expect(prisma.product.findMany.mock.calls[0][0].where).not.toHaveProperty('isOnline');
    });

    it('prend pour stock ce qui est annoncé, et là c’est bien l’état courant', async () => {
      arrange([], []);
      await service.dashboard(manager, { channel: 'online' });
      expect(prisma.product.findMany.mock.calls[1][0].where.isOnline).toBe(true);
    });

    it('omet le taux de retour, qui ne dépend pas du canal', async () => {
      // Un article rendu n'a été vendu nulle part : le filtrer par canal
      // donnerait toujours zéro, et un chiffre faux vaut moins que rien.
      arrange([], []);
      const d = await service.dashboard(manager, { channel: 'online' });
      expect(d).not.toHaveProperty('returns');
    });

    it('garde le taux de retour sans canal choisi', async () => {
      arrange([], [], []);
      const d = await service.dashboard(manager, {});
      expect(d).toHaveProperty('returns');
    });

    it('donne sa recette du jour à qui ne gère que le site', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'online.manage')]);
      arrange([
        { purchasePrice: '5', soldPrice: '20', appliedCommission: null, saleType: 'RESALE' },
      ]);
      const d = await service.dashboard(employee, { channel: 'online' });
      expect(d.today?.revenue).toBe(20);
      // La marge dirait les prix d'achat : elle reste à `stats.view`.
      expect(d.today?.margin).toBeUndefined();
    });

    it('ne la lui donne pas sur une boutique physique', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'online.manage')]);
      const d = await service.dashboard(employee, {});
      expect(d).not.toHaveProperty('today');
    });
  });

  describe('retraits à faire', () => {
    /** Le retrait est la 5e requête (dépublier) puis la 6e (décrocher). */
    const aRetirer = (over: Partial<Record<string, unknown>> = {}) => ({
      id: 'p9',
      name: 'Robe rouge',
      reference: 'A-0042',
      soldAt: new Date('2026-08-27T12:00:00.000Z'),
      shop: { id: SHOP_ID, name: 'Centre-ville' },
      status: { id: 's4', name: 'Vendu', color: '#10b981', isOnlineSale: false },
      ...over,
    });

    it('donne les deux listes au gérant, sans endroit choisi', async () => {
      arrange([], [], [], [], [aRetirer()], [aRetirer()]);
      const d = await complet();
      expect(d.removals?.toDelist?.items).toHaveLength(1);
      expect(d.removals?.toPull?.items).toHaveLength(1);
    });

    it('sur une boutique physique, ne montre que les vêtements à décrocher', async () => {
      // L'annonce à dépublier ne se traite pas depuis le rayon : l'afficher là
      // ferait apparaître une corvée que personne n'y ferait.
      arrange([], [], [], [], [aRetirer()]);
      const d = await service.dashboard(manager, { shopId: SHOP_ID });
      expect(d.removals?.toPull?.items).toHaveLength(1);
      expect(d.removals?.toDelist).toBeUndefined();
    });

    it('sur la boutique en ligne, ne montre que les annonces à retirer', async () => {
      arrange([], [], [], [aRetirer()]);
      const d = await service.dashboard(manager, { channel: 'online' });
      expect(d.removals?.toDelist?.items).toHaveLength(1);
      expect(d.removals?.toPull).toBeUndefined();
    });

    it('sépare les deux sens par le flag du statut, jamais par son libellé', async () => {
      arrange([], [], [], [], [], []);
      await complet();
      const appels = prisma.product.findMany.mock.calls.slice(-2);
      expect(appels[0][0].where.status).toEqual({ isOnlineSale: false });
      expect(appels[1][0].where.status).toEqual({ isOnlineSale: true });
      for (const appel of appels) expect(appel[0].where.pendingRemoval).toBe(true);
    });

    it('ne donne que les annonces à dépublier à qui ne gère que le web', async () => {
      // Décrocher un vêtement n'est pas son travail : lui montrer la liste
      // ferait apparaître une corvée que personne ne prendrait.
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'online.manage')]);
      arrange([aRetirer()]);
      const d = await service.dashboard(employee, {});
      expect(d.removals?.toDelist?.items).toHaveLength(1);
      expect(d.removals?.toPull).toBeUndefined();
    });

    it('ne donne que les vêtements à décrocher à qui tient la boutique', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'products.manage')]);
      arrange([
        aRetirer({
          status: { id: 's5', name: 'Vendu en ligne', color: '#0ea5e9', isOnlineSale: true },
        }),
      ]);
      const d = await service.dashboard(employee, {});
      expect(d.removals?.toPull?.items).toHaveLength(1);
      expect(d.removals?.toDelist).toBeUndefined();
    });

    it('omet le bloc entier quand aucun des deux droits n’est détenu', async () => {
      // Un bloc absent est un droit qui manque, pas une absence de corvée.
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'stats.view')]);
      arrange([], [], []);
      const d = await service.dashboard(employee, {});
      expect(d).not.toHaveProperty('removals');
    });

    it('suit la boutique choisie dans le sélecteur', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'products.manage')]);
      arrange([]);
      await service.dashboard(employee, { shopId: 'b2' });
      expect(prisma.product.findMany.mock.calls[0][0].where.shopId).toBe('b2');
    });

    it('refuse une boutique où le droit n’est pas détenu', async () => {
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'products.manage')]);
      const d = await service.dashboard(employee, { shopId: 'b3' });
      expect(d).not.toHaveProperty('removals');
    });

    it('ne découpe pas la boutique en ligne par boutique physique', async () => {
      // `online.manage` est un droit d'entreprise : le site est unique. Le
      // restreindre aux boutiques où la case est cochée laisserait des annonces
      // vendues sans personne pour les ôter.
      prisma.shopAccess.findMany.mockResolvedValue([acces('b2', 'online.manage')]);
      arrange([]);
      await service.dashboard(employee, { channel: 'online' });
      expect(prisma.product.findMany.mock.calls[0][0].where).not.toHaveProperty('OR');
    });

    it('n’en ramène que cinq, et dit le compte réel', async () => {
      // Le tableau de bord n'est qu'un aperçu : ramener la liste entière
      // alourdirait chaque chargement pour des lignes qu'on n'y lit pas. Une
      // troncature muette, elle, se lirait comme « tout est là ».
      prisma.product.count.mockResolvedValue(213);
      arrange([], [], [], [], [aRetirer()]);
      const d = await complet();
      expect(d.removals?.toDelist?.items).toHaveLength(1);
      expect(d.removals?.toDelist?.total).toBe(213);
      const appel = prisma.product.findMany.mock.calls.at(-2)!;
      expect(appel[0].take).toBe(5);
    });

    it('montre les plus récentes d’abord', async () => {
      arrange([], [], [], [], [], []);
      await complet();
      const appels = prisma.product.findMany.mock.calls.slice(-2);
      for (const appel of appels) expect(appel[0].orderBy).toEqual({ soldAt: 'desc' });
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
      const { returns } = await complet();
      expect(returns).toEqual({ consignmentOverPeriod: 4, returned: 1, rate: 25 });
    });

    it('rend un taux nul quand aucun dépôt n’a été créé', async () => {
      arrange([], [], []);
      const { returns } = await complet();
      expect(returns).toEqual({ consignmentOverPeriod: 0, returned: 0, rate: 0 });
    });
  });
});
