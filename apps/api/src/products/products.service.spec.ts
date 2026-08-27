import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService, shopOfProduct } from './products.service';
import type { StatusesService } from '../statuses/statuses.service';
import type { UploadsService } from '../uploads/uploads.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, SHOP_ID, employee, inStock, manager, returned, sold } from '../test/fixtures';

const product = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'p1',
  companyId: COMPANY_ID,
  shopId: SHOP_ID,
  categoryId: 'cat-1',
  statusId: inStock.id,
  name: 'Sac',
  saleType: 'RESALE',
  depositContractId: null,
  depositorPaid: null,
  photoUrl: null,
  ...over,
});

describe('ProductsService', () => {
  let prisma: PrismaMock;
  let statuses: { defaults: jest.Mock; checkTransition: jest.Mock };
  let uploads: { delete: jest.Mock };
  let service: ProductsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    statuses = {
      defaults: jest.fn().mockResolvedValue(inStock),
      checkTransition: jest.fn().mockResolvedValue(undefined),
    };
    uploads = { delete: jest.fn().mockResolvedValue(undefined) };
    service = new ProductsService(
      asPrisma(prisma),
      statuses as unknown as StatusesService,
      uploads as unknown as UploadsService,
    );
    // `detail` clôt presque toutes les écritures.
    prisma.product.findFirst.mockResolvedValue(product());
  });

  describe('list', () => {
    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([0, []]);
    });

    it('pagine et rend les compteurs', async () => {
      prisma.$transaction.mockResolvedValue([42, []]);
      const page = await service.list(manager, { page: 2, perPage: 10 });
      expect(page).toMatchObject({ total: 42, page: 2, perPage: 10, pages: 5 });
    });

    it('rend au moins une page même sans résultat', async () => {
      const page = await service.list(manager, {});
      expect(page.pages).toBe(1);
    });

    it('laisse le gérant voir tout le stock de son entreprise', async () => {
      await service.list(manager, {});
      const where = prisma.product.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe(COMPANY_ID);
      expect(where).not.toHaveProperty('OR');
    });

    it("restreint l'employé à ses boutiques, plus le stock central", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([{ shopId: SHOP_ID }]);
      await service.list(employee, {});
      expect(prisma.product.findMany.mock.calls[0][0].where.OR).toEqual([
        { shopId: null },
        { shopId: { in: [SHOP_ID] } },
      ]);
    });

    it('sait isoler le stock central', async () => {
      await service.list(manager, { unassigned: 'true' });
      expect(prisma.product.findMany.mock.calls[0][0].where.shopId).toBeNull();
    });

    it('filtre sur une boutique de l’entreprise', async () => {
      prisma.shop.findFirst.mockResolvedValue({ id: SHOP_ID });
      await service.list(manager, { shopId: SHOP_ID });
      expect(prisma.product.findMany.mock.calls[0][0].where.shopId).toBe(SHOP_ID);
    });

    it("vérifie que la boutique filtrée appartient à l'entreprise", async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.list(manager, { shopId: 'pirate' })).rejects.toThrow(
        "n'appartient pas à votre entreprise",
      );
    });

    it('cherche à la fois dans le nom, la référence et la description', async () => {
      await service.list(manager, { search: 'bott' });
      const or = prisma.product.findMany.mock.calls[0][0].where.OR;
      expect(or.map((c: Record<string, unknown>) => Object.keys(c)[0])).toEqual([
        'name',
        'reference',
        'description',
      ]);
    });
  });

  describe('detail', () => {
    it("refuse un produit d'une autre entreprise", async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.detail(manager, 'p1')).rejects.toThrow(NotFoundException);
    });

    it("cache à l'employé un produit d'une boutique où il n'a pas accès", async () => {
      prisma.product.findFirst.mockResolvedValue(product({ shopId: 'shop-interdite' }));
      prisma.shopAccess.count.mockResolvedValue(0);
      await expect(service.detail(employee, 'p1')).rejects.toThrow('Produit introuvable.');
    });

    it("laisse l'employé voir un produit du stock central", async () => {
      prisma.product.findFirst.mockResolvedValue(product({ shopId: null }));
      await expect(service.detail(employee, 'p1')).resolves.toBeDefined();
      expect(prisma.shopAccess.count).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const dto = { name: 'Sac', categoryId: 'cat-1', saleType: 'RESALE' as const };

    beforeEach(() => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
      prisma.shop.findFirst.mockResolvedValue({ id: SHOP_ID });
      prisma.product.create.mockResolvedValue(product());
    });

    it("applique le statut par défaut de l'entreprise", async () => {
      await service.create(manager, dto);
      expect(statuses.defaults).toHaveBeenCalledWith(COMPANY_ID);
      expect(prisma.product.create.mock.calls[0][0].data.statusId).toBe(inStock.id);
    });

    it('crée un produit non assigné quand aucune boutique n’est donnée', async () => {
      await service.create(manager, dto);
      expect(prisma.product.create.mock.calls[0][0].data.shopId).toBeNull();
    });

    it('applique une quantité de 1 par défaut', async () => {
      await service.create(manager, dto);
      expect(prisma.product.create.mock.calls[0][0].data.quantity).toBe(1);
    });

    it('trace la création dans l’historique de statut', async () => {
      await service.create(manager, dto);
      expect(prisma.statusHistory.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          statusId: inStock.id,
          changedByUserId: manager.userId,
          note: 'Création du produit',
        },
      });
    });

    it('enregistre tous les champs facultatifs quand ils sont fournis', async () => {
      prisma.status.findFirst.mockResolvedValue(inStock);
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { attribute: { id: 'a1', name: 'Couleur', type: 'TEXT', options: [] } },
      ]);
      await service.create(manager, {
        ...dto,
        shopId: SHOP_ID,
        statusId: inStock.id,
        reference: 'BTR6',
        description: 'Cuir souple',
        internalNote: 'Vu en vitrine',
        photoUrl: 'company-1/x.webp',
        purchasePrice: 10,
        salePrice: 45,
        quantity: 3,
        attributes: [{ attributeDefinitionId: 'a1', value: 'Beige' }],
      });
      expect(prisma.product.create.mock.calls[0][0].data).toMatchObject({
        shopId: SHOP_ID,
        statusId: inStock.id,
        reference: 'BTR6',
        description: 'Cuir souple',
        internalNote: 'Vu en vitrine',
        photoUrl: 'company-1/x.webp',
        purchasePrice: 10,
        salePrice: 45,
        quantity: 3,
      });
    });

    it('laisse les champs facultatifs à null quand ils sont absents', async () => {
      await service.create(manager, dto);
      expect(prisma.product.create.mock.calls[0][0].data).toMatchObject({
        description: null,
        internalNote: null,
        photoUrl: null,
        purchasePrice: null,
        salePrice: null,
        depositContractId: null,
      });
    });

    it('génère une référence depuis le compteur de l’entreprise', async () => {
      await service.create(manager, dto);
      expect(prisma.product.create.mock.calls[0][0].data.reference).toBe('A-0001');
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
        data: { productCounter: { increment: 1 } },
        select: { productCounter: true },
      });
    });

    it('garde la référence saisie plutôt que d’en générer une', async () => {
      await service.create(manager, { ...dto, reference: '  BTR6 ' });
      expect(prisma.product.create.mock.calls[0][0].data.reference).toBe('BTR6');
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('génère depuis le déposant du contrat pour un dépôt-vente', async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ id: 'c1', depositorId: 'dep-1' });
      await service.create(manager, {
        ...dto,
        saleType: 'CONSIGNMENT',
        depositContractId: 'c1',
      });
      expect(prisma.product.create.mock.calls[0][0].data.reference).toBe('D-MAR-001');
      // Le compteur du déposant, pas celui de l'entreprise.
      expect(prisma.company.update).not.toHaveBeenCalled();
      expect(prisma.depositor.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { productCounter: { increment: 1 } },
        select: { productCounter: true },
      });
    });

    it('attribue son code à un déposant qui n’en a pas encore', async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ id: 'c1', depositorId: 'dep-1' });
      prisma.depositor.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        code: null,
        lastName: 'Durand',
        firstName: null,
      });
      prisma.depositor.findMany.mockResolvedValue([{ code: 'MAR' }]);
      await service.create(manager, {
        ...dto,
        saleType: 'CONSIGNMENT',
        depositContractId: 'c1',
      });
      expect(prisma.depositor.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { code: 'DUR' },
      });
      expect(prisma.product.create.mock.calls[0][0].data.reference).toBe('D-DUR-001');
    });

    it('refuse une référence déjà utilisée, en la nommant', async () => {
      prisma.product.create.mockRejectedValue(
        Object.assign(new Error('unique'), {
          code: 'P2002',
          meta: { target: ['company_id', 'reference'] },
        }),
      );
      await expect(service.create(manager, { ...dto, reference: 'BTR6' })).rejects.toThrow(
        'La référence « BTR6 » est déjà utilisée.',
      );
    });

    it('laisse remonter une autre erreur de base telle quelle', async () => {
      prisma.product.create.mockRejectedValue(new Error('connexion perdue'));
      await expect(service.create(manager, dto)).rejects.toThrow('connexion perdue');
    });

    it("refuse une catégorie d'une autre entreprise", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.create(manager, dto)).rejects.toThrow(BadRequestException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('exige un contrat pour un produit en dépôt-vente', async () => {
      await expect(service.create(manager, { ...dto, saleType: 'CONSIGNMENT' })).rejects.toThrow(
        'doit être rattaché à un contrat',
      );
    });

    it('refuse un contrat sur un produit en achat-revente', async () => {
      await expect(service.create(manager, { ...dto, depositContractId: 'c1' })).rejects.toThrow(
        "n'est rattaché à aucun contrat",
      );
    });

    it("refuse un contrat d'une autre entreprise", async () => {
      prisma.depositContract.findFirst.mockResolvedValue(null);
      await expect(
        service.create(manager, { ...dto, saleType: 'CONSIGNMENT', depositContractId: 'c1' }),
      ).rejects.toThrow("n'appartient pas à votre entreprise");
    });

    it("ignore le prix d'achat sur un dépôt-vente : l'article n'est pas à la boutique", async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ id: 'c1' });
      await service.create(manager, {
        ...dto,
        saleType: 'CONSIGNMENT',
        depositContractId: 'c1',
        purchasePrice: 10,
      });
      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.purchasePrice).toBeNull();
      expect(data.depositorPaid).toBe(false);
    });

    it('laisse depositorPaid vide en achat-revente : la question ne se pose pas', async () => {
      await service.create(manager, dto);
      expect(prisma.product.create.mock.calls[0][0].data.depositorPaid).toBeNull();
    });

    it("refuse un attribut qui ne s'applique pas à la catégorie", async () => {
      prisma.categoryAttribute.findMany.mockResolvedValue([]);
      await expect(
        service.create(manager, {
          ...dto,
          attributes: [{ attributeDefinitionId: 'a1', value: 'Noir' }],
        }),
      ).rejects.toThrow("ne s'applique pas à la catégorie");
    });

    it('refuse deux fois le même attribut', async () => {
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { attribute: { id: 'a1', name: 'Couleur', type: 'TEXT', options: [] } },
      ]);
      await expect(
        service.create(manager, {
          ...dto,
          attributes: [
            { attributeDefinitionId: 'a1', value: 'Noir' },
            { attributeDefinitionId: 'a1', value: 'Beige' },
          ],
        }),
      ).rejects.toThrow('renseigné deux fois');
    });
  });

  describe('createLot', () => {
    const lot = {
      totalPurchasePrice: 7,
      lines: [
        { name: 'T-shirt', categoryId: 'cat-1', salePrice: 10, count: 4 },
        { name: 'Chemise', categoryId: 'cat-1', salePrice: 20, count: 2 },
      ],
    };

    beforeEach(() => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
      prisma.shop.findFirst.mockResolvedValue({ id: SHOP_ID });
      prisma.product.create.mockResolvedValue(product());
    });

    /** Prix d'achat effectivement écrits, dans l'ordre de création. */
    function achats(): number[] {
      return prisma.product.create.mock.calls.map(
        (c: [{ data: { purchasePrice: number } }]) => c[0].data.purchasePrice,
      );
    }

    it('crée un produit distinct par exemplaire, jamais une quantité', async () => {
      const { count } = await service.createLot(manager, lot);
      expect(count).toBe(6);
      expect(prisma.product.create).toHaveBeenCalledTimes(6);
      expect(
        prisma.product.create.mock.calls.every(
          (c: [{ data: { quantity: number } }]) => c[0].data.quantity === 1,
        ),
      ).toBe(true);
    });

    it('répartit le prix payé au prorata des prix de vente', async () => {
      await service.createLot(manager, lot);
      expect(achats()).toEqual([0.88, 0.88, 0.87, 0.87, 1.75, 1.75]);
    });

    it('la somme des prix d’achat retombe sur le prix payé', async () => {
      await service.createLot(manager, lot);
      expect(Math.round(achats().reduce((t, p) => t + p, 0) * 100) / 100).toBe(7);
    });

    it('achète tout en achat-revente : un lot ne se dépose pas', async () => {
      await service.createLot(manager, lot);
      expect(
        prisma.product.create.mock.calls.every(
          (c: [{ data: { saleType: string; depositContractId: string | null } }]) =>
            c[0].data.saleType === 'RESALE' && c[0].data.depositContractId === null,
        ),
      ).toBe(true);
    });

    it('suffixe les références des exemplaires multiples', async () => {
      await service.createLot(manager, {
        totalPurchasePrice: 4,
        lines: [{ name: 'T-shirt', categoryId: 'cat-1', reference: 'BTR6', count: 3 }],
      });
      expect(
        prisma.product.create.mock.calls.map(
          (c: [{ data: { reference: string } }]) => c[0].data.reference,
        ),
      ).toEqual(['BTR6-1', 'BTR6-2', 'BTR6-3']);
    });

    it('laisse la référence intacte pour un exemplaire unique', async () => {
      await service.createLot(manager, {
        totalPurchasePrice: 2,
        lines: [{ name: 'T-shirt', categoryId: 'cat-1', reference: 'BTR6' }],
      });
      expect(prisma.product.create.mock.calls[0][0].data.reference).toBe('BTR6');
    });

    it('génère une référence par exemplaire quand aucune n’est saisie', async () => {
      await service.createLot(manager, {
        totalPurchasePrice: 2,
        lines: [{ name: 'T-shirt', categoryId: 'cat-1', count: 2 }],
      });
      expect(
        prisma.product.create.mock.calls.map(
          (c: [{ data: { reference: string } }]) => c[0].data.reference,
        ),
      ).toEqual(['A-0001', 'A-0002']);
    });

    it('applique la boutique du lot à tous les articles', async () => {
      await service.createLot(manager, { ...lot, shopId: SHOP_ID });
      expect(
        prisma.product.create.mock.calls.every(
          (c: [{ data: { shopId: string } }]) => c[0].data.shopId === SHOP_ID,
        ),
      ).toBe(true);
    });

    it('laisse le lot au stock central quand aucune boutique n’est choisie', async () => {
      await service.createLot(manager, lot);
      expect(prisma.product.create.mock.calls[0][0].data.shopId).toBeNull();
    });

    it('partage à parts égales quand aucun prix de vente n’est saisi', async () => {
      await service.createLot(manager, {
        totalPurchasePrice: 6,
        lines: [{ name: 'Vrac', categoryId: 'cat-1', count: 3 }],
      });
      expect(achats()).toEqual([2, 2, 2]);
    });

    it('donne à un article non étiqueté la moyenne des autres', async () => {
      await service.createLot(manager, {
        totalPurchasePrice: 45,
        lines: [
          { name: 'Robe', categoryId: 'cat-1', salePrice: 10 },
          { name: 'Sac', categoryId: 'cat-1', salePrice: 20 },
          { name: 'À trier', categoryId: 'cat-1' },
        ],
      });
      expect(achats()).toEqual([10, 20, 15]);
    });

    it('laisse à zéro un article explicitement donné', async () => {
      await service.createLot(manager, {
        totalPurchasePrice: 30,
        lines: [
          { name: 'Robe', categoryId: 'cat-1', salePrice: 10 },
          { name: 'Sac', categoryId: 'cat-1', salePrice: 20 },
          { name: 'Cadeau', categoryId: 'cat-1', salePrice: 0 },
        ],
      });
      expect(achats()).toEqual([10, 20, 0]);
    });

    it('écrit tout dans une seule transaction', async () => {
      await service.createLot(manager, lot);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('situe l’erreur sur la ligne fautive', async () => {
      prisma.category.findFirst.mockResolvedValueOnce({ id: 'cat-1' }).mockResolvedValue(null);
      await expect(
        service.createLot(manager, {
          totalPurchasePrice: 4,
          lines: [
            { name: 'T-shirt', categoryId: 'cat-1' },
            { name: 'Chemise', categoryId: 'pirate' },
          ],
        }),
      ).rejects.toThrow("Ligne 2 (Chemise) : Cette catégorie n'appartient pas à votre entreprise.");
    });

    it('numérote la ligne, et non l’exemplaire', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce({ id: 'cat-1' })
        .mockResolvedValueOnce({ id: 'cat-1' })
        .mockResolvedValue(null);
      await expect(
        service.createLot(manager, {
          totalPurchasePrice: 4,
          lines: [
            { name: 'T-shirt', categoryId: 'cat-1', count: 2 },
            { name: 'Chemise', categoryId: 'pirate' },
          ],
        }),
      ).rejects.toThrow('Ligne 2 (Chemise)');
    });

    it('rend les identifiants créés, pour rebondir sur le stock', async () => {
      const { productIds, totalPurchasePrice } = await service.createLot(manager, {
        totalPurchasePrice: 2,
        lines: [{ name: 'T-shirt', categoryId: 'cat-1' }],
      });
      expect(productIds).toEqual(['p1']);
      expect(totalPurchasePrice).toBe(2);
    });

    it('trace la création de chaque article dans son historique', async () => {
      await service.createLot(manager, lot);
      expect(prisma.statusHistory.create).toHaveBeenCalledTimes(6);
    });
  });

  describe('changeStatus', () => {
    beforeEach(() => {
      prisma.status.findFirst.mockResolvedValue(sold);
      prisma.status.findUniqueOrThrow.mockResolvedValue(inStock);
    });

    it('consulte le flux de l’entreprise avant tout', async () => {
      await service.changeStatus(manager, 'p1', { statusId: sold.id, soldPrice: 30 });
      expect(statuses.checkTransition).toHaveBeenCalledWith(COMPANY_ID, inStock.id, sold.id);
    });

    it('exige un prix vendu pour un statut de vente', async () => {
      await expect(service.changeStatus(manager, 'p1', { statusId: sold.id })).rejects.toThrow(
        'indiquez le prix vendu',
      );
    });

    it('horodate la vente à maintenant si la date n’est pas donnée', async () => {
      await service.changeStatus(manager, 'p1', { statusId: sold.id, soldPrice: 30 });
      expect(prisma.product.update.mock.calls[0][0].data.soldAt).toBeInstanceOf(Date);
    });

    it('respecte une date de vente fournie', async () => {
      await service.changeStatus(manager, 'p1', {
        statusId: sold.id,
        soldPrice: 30,
        soldAt: '2026-08-01',
      });
      expect(prisma.product.update.mock.calls[0][0].data.soldAt).toEqual(new Date('2026-08-01'));
    });

    it('gèle la commission du contrat au moment de la vente', async () => {
      prisma.product.findFirst.mockResolvedValue(
        product({ saleType: 'CONSIGNMENT', depositContractId: 'c1' }),
      );
      prisma.depositContract.findUniqueOrThrow.mockResolvedValue({ commission: 40 });
      await service.changeStatus(manager, 'p1', { statusId: sold.id, soldPrice: 100 });
      expect(prisma.product.update.mock.calls[0][0].data.appliedCommission).toBe(40);
    });

    it('ne gèle rien pour un achat-revente', async () => {
      await service.changeStatus(manager, 'p1', { statusId: sold.id, soldPrice: 30 });
      expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('appliedCommission');
    });

    it('interdit de revendre un produit rendu, quel que soit son libellé', async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue(returned);
      await expect(
        service.changeStatus(manager, 'p1', { statusId: sold.id, soldPrice: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("interdit de toucher au prix vendu d'un produit rendu", async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue(returned);
      prisma.status.findFirst.mockResolvedValue(inStock);
      await expect(
        service.changeStatus(manager, 'p1', { statusId: inStock.id, soldPrice: 10 }),
      ).rejects.toThrow('son prix vendu ne peut plus être modifié');
    });

    it('refuse un prix vendu sur un statut qui n’est pas une vente', async () => {
      prisma.status.findFirst.mockResolvedValue(inStock);
      await expect(
        service.changeStatus(manager, 'p1', { statusId: inStock.id, soldPrice: 10 }),
      ).rejects.toThrow("n'est pas un statut de vente");
    });

    it('trace le changement, avec sa note', async () => {
      await service.changeStatus(manager, 'p1', {
        statusId: sold.id,
        soldPrice: 30,
        note: 'Négocié',
      });
      expect(prisma.statusHistory.create.mock.calls[0][0].data).toMatchObject({
        productId: 'p1',
        statusId: sold.id,
        changedByUserId: manager.userId,
        note: 'Négocié',
      });
    });

    it("refuse un statut d'une autre entreprise", async () => {
      prisma.status.findFirst.mockResolvedValue(null);
      await expect(service.changeStatus(manager, 'p1', { statusId: 'x' })).rejects.toThrow(
        "n'appartient pas à votre entreprise",
      );
    });
  });

  describe('sellMany', () => {
    const lignes = [
      { productId: 'p1', soldPrice: 28.89 },
      { productId: 'p2', soldPrice: 10.83 },
    ];

    beforeEach(() => {
      prisma.status.findMany.mockResolvedValue([{ id: sold.id, name: 'Vendu' }]);
      prisma.status.findUniqueOrThrow.mockResolvedValue(inStock);
      prisma.status.findFirst.mockResolvedValue(sold);
      prisma.product.findMany.mockResolvedValue([
        { ...product({ id: 'p1', name: 'Veste' }) },
        { ...product({ id: 'p2', name: 'Ceinture' }) },
      ]);
    });

    it('passe chaque article à vendu avec son propre prix', async () => {
      await service.sellMany(manager, { lines: lignes });
      expect(prisma.product.update).toHaveBeenCalledTimes(2);
      expect(
        prisma.product.update.mock.calls.map(
          (c: [{ data: { soldPrice: number } }]) => c[0].data.soldPrice,
        ),
      ).toEqual([28.89, 10.83]);
    });

    it('rend le total encaissé, arrondi au centime', async () => {
      await expect(service.sellMany(manager, { lines: lignes })).resolves.toMatchObject({
        count: 2,
        total: 39.72,
      });
    });

    it('trouve le statut de vente par son flag, jamais par son libellé', async () => {
      await service.sellMany(manager, { lines: lignes });
      expect(prisma.status.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, isSale: true },
        select: { id: true, name: true },
      });
    });

    it('horodate toutes les lignes du même passage', async () => {
      await service.sellMany(manager, { lines: lignes });
      const dates = prisma.product.update.mock.calls.map((c: [{ data: { soldAt: Date } }]) =>
        c[0].data.soldAt.getTime(),
      );
      expect(new Set(dates).size).toBe(1);
    });

    it('écrit tout dans une seule transaction', async () => {
      await service.sellMany(manager, { lines: lignes });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('gèle la commission des articles en dépôt', async () => {
      prisma.product.findMany.mockResolvedValue([
        product({ id: 'p1', name: 'Sac', saleType: 'CONSIGNMENT', depositContractId: 'c1' }),
      ]);
      prisma.depositContract.findUniqueOrThrow.mockResolvedValue({ commission: 40 });
      await service.sellMany(manager, { lines: [{ productId: 'p1', soldPrice: 54.17 }] });
      expect(prisma.product.update.mock.calls[0][0].data.appliedCommission).toBe(40);
    });

    it("refuse un article d'une autre entreprise", async () => {
      prisma.product.findMany.mockResolvedValue([product({ id: 'p1' })]);
      await expect(service.sellMany(manager, { lines: lignes })).rejects.toThrow(
        "n'appartient pas à votre entreprise",
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("cache à l'employé un article d'une boutique où il n'a pas accès", async () => {
      prisma.product.findMany.mockResolvedValue([
        product({ id: 'p1', shopId: 'shop-interdite' }),
        product({ id: 'p2', shopId: 'shop-interdite' }),
      ]);
      prisma.shopAccess.count.mockResolvedValue(0);
      await expect(service.sellMany(employee, { lines: lignes })).rejects.toThrow(
        'Produit introuvable.',
      );
    });

    it('nomme l’article fautif plutôt que de laisser deviner', async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue(returned);
      await expect(service.sellMany(manager, { lines: lignes })).rejects.toThrow(
        'Veste : Ce produit est « Rendu au client » : il ne peut plus être vendu.',
      );
    });

    it("refuse quand aucun statut de vente n'existe", async () => {
      prisma.status.findMany.mockResolvedValue([]);
      await expect(service.sellMany(manager, { lines: lignes })).rejects.toThrow(
        'Aucun statut de vente',
      );
    });

    it('demande lequel quand l’entreprise en a plusieurs', async () => {
      prisma.status.findMany.mockResolvedValue([
        { id: 's1', name: 'Vendu' },
        { id: 's2', name: 'Vendu en ligne' },
      ]);
      await expect(service.sellMany(manager, { lines: lignes })).rejects.toThrow(
        'Plusieurs statuts de vente existent (Vendu, Vendu en ligne)',
      );
    });

    it('accepte un statut de vente désigné explicitement', async () => {
      await service.sellMany(manager, { lines: lignes, statusId: sold.id });
      expect(prisma.status.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateSale', () => {
    it('corrige le prix encaissé d’un produit vendu', async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue(sold);
      await service.updateSale(manager, 'p1', { soldPrice: 35 });
      expect(prisma.product.update.mock.calls[0][0].data.soldPrice).toBe(35);
    });

    it("refuse s'il n'y a pas de vente à corriger", async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue(inStock);
      await expect(service.updateSale(manager, 'p1', { soldPrice: 35 })).rejects.toThrow(
        'pas de vente à corriger',
      );
    });

    it('refuse sur un produit rendu au déposant', async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue({ ...returned, isSale: true });
      await expect(service.updateSale(manager, 'p1', { soldPrice: 35 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuse une commission sur un achat-revente', async () => {
      prisma.status.findUniqueOrThrow.mockResolvedValue(sold);
      await expect(service.updateSale(manager, 'p1', { appliedCommission: 40 })).rejects.toThrow(
        "qu'aux produits en dépôt-vente",
      );
    });

    it('accepte une commission sur un dépôt-vente', async () => {
      prisma.product.findFirst.mockResolvedValue(product({ saleType: 'CONSIGNMENT' }));
      prisma.status.findUniqueOrThrow.mockResolvedValue(sold);
      await service.updateSale(manager, 'p1', { appliedCommission: 40 });
      expect(prisma.product.update.mock.calls[0][0].data.appliedCommission).toBe(40);
    });
  });

  describe('toggleDepositorPayment', () => {
    it('coche le règlement d’un dépôt-vente vendu', async () => {
      prisma.product.findFirst.mockResolvedValue(product({ saleType: 'CONSIGNMENT' }));
      prisma.status.findUniqueOrThrow.mockResolvedValue({ isSale: true, name: 'Vendu' });
      await service.toggleDepositorPayment(manager, 'p1', true);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { depositorPaid: true },
      });
    });

    it("refuse sur un achat-revente : il n'y a personne à régler", async () => {
      await expect(service.toggleDepositorPayment(manager, 'p1', true)).rejects.toThrow(
        "n'est pas en dépôt-vente",
      );
    });

    it("refuse tant que le produit n'est pas vendu", async () => {
      prisma.product.findFirst.mockResolvedValue(product({ saleType: 'CONSIGNMENT' }));
      prisma.status.findUniqueOrThrow.mockResolvedValue({ isSale: false, name: 'En rayon' });
      await expect(service.toggleDepositorPayment(manager, 'p1', true)).rejects.toThrow(
        'rien à reverser',
      );
    });
  });

  describe('assignShop', () => {
    it('assigne à une boutique de l’entreprise', async () => {
      prisma.shop.findFirst.mockResolvedValue({ id: SHOP_ID });
      await service.assignShop(manager, 'p1', { shopId: SHOP_ID });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { shopId: SHOP_ID },
      });
    });

    it('renvoie un produit au stock central', async () => {
      await service.assignShop(manager, 'p1', {});
      expect(prisma.product.update.mock.calls[0][0].data.shopId).toBeNull();
    });

    it("refuse une boutique d'une autre entreprise", async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.assignShop(manager, 'p1', { shopId: 'pirate' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('supprime le produit et sa photo', async () => {
      prisma.product.findFirst.mockResolvedValue(product({ photoUrl: 'company/x.webp' }));
      await expect(service.delete(manager, 'p1')).resolves.toEqual({ deleted: true });
      expect(uploads.delete).toHaveBeenCalledWith('company/x.webp');
    });

    it("n'appelle pas le stockage quand il n'y a pas de photo", async () => {
      await service.delete(manager, 'p1');
      expect(uploads.delete).not.toHaveBeenCalled();
    });

    it("refuse un produit d'une autre entreprise", async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.delete(manager, 'p1')).rejects.toThrow(NotFoundException);
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });
  });
});

describe('ProductsService — export CSV et mise à jour', () => {
  let prisma: PrismaMock;
  let service: ProductsService;

  const ligneCsv = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'p1',
    reference: 'BTR6',
    name: 'Bottines',
    description: null,
    internalNote: null,
    purchasePrice: '10',
    salePrice: '45',
    soldPrice: '40',
    appliedCommission: null,
    depositorPaid: null,
    saleType: 'RESALE',
    soldAt: new Date('2026-08-20T10:00:00.000Z'),
    category: { name: 'Chaussures' },
    shop: { name: 'Centre-ville' },
    status: { name: 'Vendu' },
    depositContract: null,
    attributeValues: [],
    attributeOptions: [],
    ...over,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ProductsService(
      asPrisma(prisma),
      { defaults: jest.fn(), checkTransition: jest.fn() } as unknown as StatusesService,
      { delete: jest.fn() } as unknown as UploadsService,
    );
  });

  describe('exportCsv', () => {
    it('ouvre par un BOM et sépare par des points-virgules, pour Excel FR', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      const csv = await service.exportCsv(manager, {});
      expect(csv.startsWith('﻿')).toBe(true);
      expect(csv.split('\r\n')[0]).toContain('Référence;Catégorie;Boutique');
    });

    it('exporte les colonnes fixes en français', async () => {
      prisma.product.findMany.mockResolvedValue([ligneCsv()]);
      const [, ligne] = (await service.exportCsv(manager, {})).split('\r\n');
      expect(ligne).toContain('BTR6;Chaussures;Centre-ville;Bottines');
      expect(ligne).toContain('Achat-revente');
      expect(ligne).toContain('20/08/2026');
    });

    it('note « Stock central » pour un produit non assigné', async () => {
      prisma.product.findMany.mockResolvedValue([ligneCsv({ shop: null })]);
      expect(await service.exportCsv(manager, {})).toContain('Stock central');
    });

    it('nomme le déposant en dépôt-vente', async () => {
      prisma.product.findMany.mockResolvedValue([
        ligneCsv({
          saleType: 'CONSIGNMENT',
          depositContract: { depositor: { firstName: 'Sophie', lastName: 'Martin' } },
          appliedCommission: '40',
          depositorPaid: true,
        }),
      ]);
      const csv = await service.exportCsv(manager, {});
      expect(csv).toContain('Sophie Martin');
      expect(csv).toContain('Dépôt-vente');
      expect(csv).toContain(';oui');
    });

    it('utilise la virgule décimale', async () => {
      prisma.product.findMany.mockResolvedValue([ligneCsv({ salePrice: '45.50' })]);
      expect(await service.exportCsv(manager, {})).toContain('45,50');
    });

    it('ajoute une colonne par attribut réellement présent', async () => {
      prisma.product.findMany.mockResolvedValue([
        ligneCsv({
          attributeValues: [
            {
              textValue: 'Beige',
              numberValue: null,
              booleanValue: null,
              attribute: { name: 'Couleur' },
            },
          ],
          attributeOptions: [{ option: { value: 'Minelli', attribute: { name: 'Marque' } } }],
        }),
      ]);
      const [entetes, ligne] = (await service.exportCsv(manager, {})).split('\r\n');
      // Les colonnes dynamiques sont triées, donc Couleur avant Marque.
      expect(entetes.endsWith('Couleur;Marque')).toBe(true);
      expect(ligne.endsWith('Beige;Minelli')).toBe(true);
    });

    it('rend les booléens en oui/non', async () => {
      prisma.product.findMany.mockResolvedValue([
        ligneCsv({
          attributeValues: [
            {
              textValue: null,
              numberValue: null,
              booleanValue: true,
              attribute: { name: 'Doublé' },
            },
          ],
        }),
      ]);
      expect((await service.exportCsv(manager, {})).split('\r\n')[1].endsWith('oui')).toBe(true);
    });

    it('laisse la cellule vide quand aucune valeur n’est renseignée', async () => {
      prisma.product.findMany.mockResolvedValue([
        ligneCsv({
          attributeValues: [
            {
              textValue: null,
              numberValue: null,
              booleanValue: null,
              attribute: { name: 'Poids' },
            },
          ],
        }),
      ]);
      const [entetes] = (await service.exportCsv(manager, {})).split('\r\n');
      expect(entetes).not.toContain('Poids');
    });

    it('sérialise un nombre décimal', async () => {
      prisma.product.findMany.mockResolvedValue([
        ligneCsv({
          attributeValues: [
            {
              textValue: null,
              numberValue: '1.5',
              booleanValue: null,
              attribute: { name: 'Poids' },
            },
          ],
        }),
      ]);
      expect((await service.exportCsv(manager, {})).split('\r\n')[1].endsWith('1.5')).toBe(true);
    });

    it('laisse les cellules vides pour un produit à peine créé', async () => {
      prisma.product.findMany.mockResolvedValue([
        ligneCsv({
          reference: null,
          purchasePrice: null,
          salePrice: null,
          soldPrice: null,
          soldAt: null,
          appliedCommission: null,
          depositorPaid: null,
        }),
      ]);
      const ligne = (await service.exportCsv(manager, {})).split('\r\n')[1];
      expect(ligne.startsWith(';Chaussures')).toBe(true);
      expect(ligne.endsWith(';;')).toBe(true);
    });

    it('applique exactement les mêmes filtres que la liste', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.exportCsv(manager, { search: 'bott' });
      expect(prisma.product.findMany.mock.calls[0][0].where.OR).toBeDefined();
      // Pas de pagination : un export ne s'arrête pas à la page en cours.
      expect(prisma.product.findMany.mock.calls[0][0]).not.toHaveProperty('take');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValue(product());
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
      prisma.shop.findFirst.mockResolvedValue({ id: SHOP_ID });
    });

    it('ne touche qu’aux champs fournis', async () => {
      await service.update(manager, 'p1', { name: 'Autre' });
      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data.name).toBe('Autre');
      expect(data).not.toHaveProperty('description');
    });

    it('renvoie un produit au stock central quand shopId est explicitement nul', async () => {
      await service.update(manager, 'p1', { shopId: null });
      expect(prisma.product.update.mock.calls[0][0].data.shopId).toBeNull();
    });

    it("efface le prix d'achat en passant en dépôt-vente", async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ id: 'c1' });
      await service.update(manager, 'p1', {
        saleType: 'CONSIGNMENT',
        depositContractId: 'c1',
      });
      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data.purchasePrice).toBeNull();
      expect(data.depositorPaid).toBe(false);
      expect(data.depositContractId).toBe('c1');
    });

    it('efface le règlement du déposant en repassant en achat-revente', async () => {
      prisma.product.findFirst.mockResolvedValue(
        product({ saleType: 'CONSIGNMENT', depositContractId: 'c1', depositorPaid: true }),
      );
      await service.update(manager, 'p1', { saleType: 'RESALE', depositContractId: undefined });
      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data.depositorPaid).toBeNull();
      expect(data.depositContractId).toBeNull();
    });

    it('ne réinitialise pas un règlement déjà saisi', async () => {
      prisma.product.findFirst.mockResolvedValue(
        product({ saleType: 'CONSIGNMENT', depositContractId: 'c1', depositorPaid: true }),
      );
      prisma.depositContract.findFirst.mockResolvedValue({ id: 'c1' });
      await service.update(manager, 'p1', { salePrice: 30 });
      expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('depositorPaid');
    });

    it('revalide les attributs contre la nouvelle catégorie', async () => {
      prisma.attributeValue.findMany.mockResolvedValue([
        { attributeDefinitionId: 'a1', textValue: 'Beige', numberValue: null, booleanValue: null },
      ]);
      prisma.productAttributeOption.findMany.mockResolvedValue([]);
      prisma.categoryAttribute.findMany.mockResolvedValue([]);
      await expect(service.update(manager, 'p1', { categoryId: 'cat-2' })).rejects.toThrow(
        "ne s'applique pas à la catégorie",
      );
    });

    it('remplace les valeurs d’attributs quand elles sont fournies', async () => {
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { attribute: { id: 'a1', name: 'Couleur', type: 'TEXT', options: [] } },
      ]);
      await service.update(manager, 'p1', {
        attributes: [{ attributeDefinitionId: 'a1', value: 'Noir' }],
      });
      expect(prisma.attributeValue.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
      });
      expect(prisma.productAttributeOption.deleteMany).toHaveBeenCalled();
    });

    it('écrit tous les champs fournis', async () => {
      prisma.attributeValue.findMany.mockResolvedValue([]);
      prisma.productAttributeOption.findMany.mockResolvedValue([]);
      await service.update(manager, 'p1', {
        name: 'Autre',
        categoryId: 'cat-1',
        shopId: SHOP_ID,
        reference: 'R2',
        description: 'd',
        internalNote: 'c',
        photoUrl: 'p',
        salePrice: 30,
        quantity: 2,
        purchasePrice: 8,
      });
      expect(prisma.product.update.mock.calls[0][0].data).toMatchObject({
        name: 'Autre',
        categoryId: 'cat-1',
        shopId: SHOP_ID,
        reference: 'R2',
        description: 'd',
        internalNote: 'c',
        photoUrl: 'p',
        salePrice: 30,
        quantity: 2,
        purchasePrice: 8,
      });
    });

    it('ne touche pas aux attributs si ni eux ni la catégorie ne changent', async () => {
      await service.update(manager, 'p1', { name: 'Autre' });
      expect(prisma.attributeValue.deleteMany).not.toHaveBeenCalled();
    });
  });
});

describe('shopOfProduct', () => {
  it("rend la boutique du produit, scopée sur l'entreprise", async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue({ shopId: SHOP_ID });
    await expect(
      asPrisma(prisma) && shopOfProduct(asPrisma(prisma), 'p1', COMPANY_ID),
    ).resolves.toBe(SHOP_ID);
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', companyId: COMPANY_ID },
      select: { shopId: true },
    });
  });

  it('rend null pour un produit introuvable — le guard retombe sur le stock central', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(shopOfProduct(asPrisma(prisma), 'p1', COMPANY_ID)).resolves.toBeNull();
  });

  it('rend null pour un produit non assigné', async () => {
    const prisma = createPrismaMock();
    prisma.product.findFirst.mockResolvedValue({ shopId: null });
    await expect(shopOfProduct(asPrisma(prisma), 'p1', COMPANY_ID)).resolves.toBeNull();
  });
});

describe('ProductsService — valeurs d’attributs conservées', () => {
  let prisma: PrismaMock;
  let service: ProductsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ProductsService(
      asPrisma(prisma),
      { defaults: jest.fn(), checkTransition: jest.fn() } as unknown as StatusesService,
      { delete: jest.fn() } as unknown as UploadsService,
    );
    prisma.product.findFirst.mockResolvedValue(product());
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-2' });
  });

  it('reprend les valeurs existantes quand seule la catégorie change', async () => {
    prisma.attributeValue.findMany.mockResolvedValue([
      { attributeDefinitionId: 'a1', textValue: 'Beige', numberValue: null, booleanValue: null },
      { attributeDefinitionId: 'a2', textValue: null, numberValue: '1.5', booleanValue: null },
      { attributeDefinitionId: 'a3', textValue: null, numberValue: null, booleanValue: true },
    ]);
    prisma.productAttributeOption.findMany.mockResolvedValue([
      { option: { id: 'o1', attributeDefinitionId: 'a4' } },
      { option: { id: 'o2', attributeDefinitionId: 'a5' } },
      { option: { id: 'o3', attributeDefinitionId: 'a5' } },
    ]);
    prisma.categoryAttribute.findMany.mockResolvedValue([
      { attribute: { id: 'a1', name: 'Couleur', type: 'TEXT', options: [] } },
      { attribute: { id: 'a2', name: 'Poids', type: 'NUMBER', options: [] } },
      { attribute: { id: 'a3', name: 'Doublé', type: 'BOOLEAN', options: [] } },
      {
        attribute: {
          id: 'a4',
          name: 'Marque',
          type: 'SELECT',
          options: [{ id: 'o1', value: 'Minelli' }],
        },
      },
      {
        attribute: {
          id: 'a5',
          name: 'Tailles',
          type: 'MULTISELECT',
          options: [
            { id: 'o2', value: 'S' },
            { id: 'o3', value: 'M' },
          ],
        },
      },
    ]);

    await service.update(manager, 'p1', { categoryId: 'cat-2' });

    // Les valeurs simples sont réécrites, les options aussi — une seule pour
    // un SELECT, plusieurs pour un MULTISELECT.
    expect(prisma.attributeValue.create).toHaveBeenCalledTimes(3);
    expect(prisma.productAttributeOption.createMany).toHaveBeenCalledTimes(2);
  });
});
