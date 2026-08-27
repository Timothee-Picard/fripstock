import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepositContractsService } from './deposit-contracts.service';
import type { ProductsService } from '../products/products.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, manager } from '../test/fixtures';

const SCOPE = { depositor: { companyId: COMPANY_ID } };

const depositor = { id: 'dep-1', companyId: COMPANY_ID, defaultCommission: 40 };
const contract = {
  id: 'c1',
  depositorId: 'dep-1',
  depositor: { id: 'dep-1', lastName: 'Martin', firstName: 'Sophie' },
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-06-01'),
  commission: 40,
  notifyBeforeDays: 7,
};

describe('DepositContractsService', () => {
  let prisma: PrismaMock;
  let products: { createWith: jest.Mock; nextReference: jest.Mock };
  let service: DepositContractsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    products = {
      createWith: jest.fn().mockResolvedValue({ id: 'p1' }),
      nextReference: jest.fn().mockResolvedValue('D-MAR-003'),
    };
    service = new DepositContractsService(asPrisma(prisma), products as unknown as ProductsService);
  });

  describe('list', () => {
    it('scope par le déposant, faute de companyId sur le contrat', async () => {
      prisma.depositContract.findMany.mockResolvedValue([]);
      await service.list(manager);
      expect(prisma.depositContract.findMany.mock.calls[0][0].where).toEqual(SCOPE);
    });

    it('trie par échéance croissante — le plus urgent en premier', async () => {
      prisma.depositContract.findMany.mockResolvedValue([]);
      await service.list(manager);
      expect(prisma.depositContract.findMany.mock.calls[0][0].orderBy).toEqual({ endDate: 'asc' });
    });
  });

  describe('detail', () => {
    it('inclut les produits du contrat', async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
      await service.detail(manager, 'c1');
      expect(prisma.depositContract.findFirst.mock.calls[0][0].where).toEqual({
        id: 'c1',
        ...SCOPE,
      });
    });

    it("refuse un contrat d'une autre entreprise", async () => {
      prisma.depositContract.findFirst.mockResolvedValue(null);
      await expect(service.detail(manager, 'c1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = { depositorId: 'dep-1', startDate: '2026-01-01', endDate: '2026-06-01' };

    beforeEach(() => {
      // `create` se termine par un `detail` : le contrat doit être relisible.
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
    });

    it('copie la commission du déposant quand elle n’est pas précisée', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      await service.create(manager, dto);
      expect(prisma.depositContract.create.mock.calls[0][0].data.commission).toBe(40);
    });

    it('accepte une commission propre au contrat', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      await service.create(manager, { ...dto, commission: 25 });
      expect(prisma.depositContract.create.mock.calls[0][0].data.commission).toBe(25);
    });

    it('accepte une commission nulle, qui n’est pas une absence', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      await service.create(manager, { ...dto, commission: 0 });
      expect(prisma.depositContract.create.mock.calls[0][0].data.commission).toBe(0);
    });

    it('applique un préavis de 7 jours par défaut', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      await service.create(manager, dto);
      expect(prisma.depositContract.create.mock.calls[0][0].data.notifyBeforeDays).toBe(7);
    });

    it('crée les articles déposés dans la même transaction que le contrat', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);

      await service.create(manager, {
        ...dto,
        products: [
          { name: 'Robe Zara', categoryId: 'cat-1', salePrice: 15 },
          { name: 'Sac cuir', categoryId: 'cat-2', salePrice: 45 },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(products.createWith).toHaveBeenCalledTimes(2);
    });

    it('force le dépôt-vente et le contrat qui vient d’être créé', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);

      await service.create(manager, {
        ...dto,
        products: [{ name: 'Robe', categoryId: 'cat-1' }],
      });

      expect(products.createWith).toHaveBeenCalledWith(expect.anything(), manager, {
        name: 'Robe',
        categoryId: 'cat-1',
        saleType: 'CONSIGNMENT',
        depositContractId: contract.id,
      });
    });

    it('accepte un contrat sans article', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      await service.create(manager, dto);
      expect(products.createWith).not.toHaveBeenCalled();
    });

    it('situe l’erreur sur la ligne fautive, sans quoi elle est inexploitable', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      products.createWith
        .mockResolvedValueOnce({ id: 'p1' })
        .mockRejectedValueOnce(new Error("Cette catégorie n'appartient pas à votre entreprise."));

      await expect(
        service.create(manager, {
          ...dto,
          products: [
            { name: 'Robe', categoryId: 'cat-1' },
            { name: 'Sac', categoryId: 'pirate' },
          ],
        }),
      ).rejects.toThrow("Article 2 (Sac) : Cette catégorie n'appartient pas à votre entreprise.");
    });

    it('ne crée rien du tout quand une ligne est refusée', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.create.mockResolvedValue(contract);
      products.createWith.mockRejectedValue(new Error('refus'));
      // La transaction remonte l'exception : c'est Prisma qui annule l'écriture
      // du contrat, on vérifie ici qu'on la laisse bien remonter.
      await expect(
        service.create(manager, { ...dto, products: [{ name: 'x', categoryId: 'c' }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it("refuse un déposant d'une autre entreprise", async () => {
      prisma.depositor.findFirst.mockResolvedValue(null);
      await expect(service.create(manager, dto)).rejects.toThrow(BadRequestException);
      expect(prisma.depositContract.create).not.toHaveBeenCalled();
    });

    it('refuse une fin antérieure ou égale au début', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      await expect(service.create(manager, { ...dto, endDate: '2025-01-01' })).rejects.toThrow(
        'La date de fin doit suivre',
      );
      await expect(service.create(manager, { ...dto, endDate: dto.startDate })).rejects.toThrow(
        'La date de fin doit suivre',
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
      prisma.depositContract.update.mockResolvedValue(contract);
    });

    it('conserve les dates existantes quand elles ne sont pas fournies', async () => {
      await service.update(manager, 'c1', { commission: 30 });
      const data = prisma.depositContract.update.mock.calls[0][0].data;
      expect(data.startDate).toBe(contract.startDate);
      expect(data.endDate).toBe(contract.endDate);
      expect(data.commission).toBe(30);
    });

    it("réarme l'alerte quand l'échéance est repoussée", async () => {
      await service.update(manager, 'c1', { endDate: '2026-12-01' });
      expect(prisma.depositContract.update.mock.calls[0][0].data.notifiedAt).toBeNull();
    });

    it("ne réarme pas l'alerte quand l'échéance ne bouge pas", async () => {
      await service.update(manager, 'c1', { commission: 10 });
      expect(prisma.depositContract.update.mock.calls[0][0].data).not.toHaveProperty('notifiedAt');
    });

    it('permet de clore un contrat', async () => {
      await service.update(manager, 'c1', { status: 'CLOSED' });
      expect(prisma.depositContract.update.mock.calls[0][0].data.status).toBe('CLOSED');
    });

    it('refuse une fin antérieure au début existant', async () => {
      await expect(service.update(manager, 'c1', { endDate: '2025-01-01' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.depositContract.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('supprime un contrat sans produit', async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
      prisma.product.count.mockResolvedValue(0);
      await expect(service.delete(manager, 'c1')).resolves.toEqual({ deleted: true });
    });

    it('refuse tant que des produits y sont rattachés', async () => {
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
      prisma.product.count.mockResolvedValue(2);
      await expect(service.delete(manager, 'c1')).rejects.toThrow(ConflictException);
      expect(prisma.depositContract.delete).not.toHaveBeenCalled();
    });
  });

  describe('attachProducts', () => {
    const enStock = {
      id: 'p1',
      name: 'Sac',
      status: { isSale: false, name: 'En stock' },
      depositContractId: null,
      depositContract: null,
    };

    beforeEach(() => {
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
    });

    it('bascule en dépôt-vente et efface le prix d’achat', async () => {
      prisma.product.findMany.mockResolvedValue([enStock]);
      await service.attachProducts(manager, 'c1', { productIds: ['p1'] });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          depositContractId: 'c1',
          saleType: 'CONSIGNMENT',
          purchasePrice: null,
          depositorPaid: false,
        },
      });
    });

    it('garde la référence par défaut — elle est écrite sur l’étiquette', async () => {
      prisma.product.findMany.mockResolvedValue([enStock]);
      await service.attachProducts(manager, 'c1', { productIds: ['p1'] });
      expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('reference');
      expect(products.nextReference).not.toHaveBeenCalled();
    });

    it('renumérote sur demande, depuis le compteur du déposant', async () => {
      prisma.product.findMany.mockResolvedValue([enStock]);
      products.nextReference.mockResolvedValue('D-MAR-003');
      await service.attachProducts(manager, 'c1', { productIds: ['p1'], renumber: true });
      expect(products.nextReference).toHaveBeenCalledWith(
        expect.anything(),
        manager,
        'CONSIGNMENT',
        { depositorId: 'dep-1' },
      );
      expect(prisma.product.update.mock.calls[0][0].data.reference).toBe('D-MAR-003');
    });

    it('donne une référence par article rattaché', async () => {
      prisma.product.findMany.mockResolvedValue([enStock, { ...enStock, id: 'p2' }]);
      products.nextReference.mockResolvedValueOnce('D-MAR-003').mockResolvedValueOnce('D-MAR-004');
      await service.attachProducts(manager, 'c1', { productIds: ['p1', 'p2'], renumber: true });
      expect(
        prisma.product.update.mock.calls.map(
          (c: [{ data: { reference: string } }]) => c[0].data.reference,
        ),
      ).toEqual(['D-MAR-003', 'D-MAR-004']);
    });

    it('refuse un produit déjà sur un autre contrat, en nommant le déposant', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...enStock,
          name: 'Robe',
          depositContractId: 'c2',
          depositContract: {
            id: 'c2',
            depositor: { lastName: 'Durand', firstName: 'Jean' },
          },
        },
      ]);
      await expect(service.attachProducts(manager, 'c1', { productIds: ['p1'] })).rejects.toThrow(
        'Déjà sur un autre contrat de dépôt : Robe (Jean Durand). Détachez-les d’abord.'.replace(
          '’',
          "'",
        ),
      );
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('accepte un produit déjà sur ce contrat — rattacher deux fois ne casse rien', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...enStock, depositContractId: 'c1', depositContract: { id: 'c1', depositor: {} } },
      ]);
      await service.attachProducts(manager, 'c1', { productIds: ['p1'] });
      expect(prisma.product.update).toHaveBeenCalled();
    });

    it("refuse un produit qui n'appartient pas à l'entreprise", async () => {
      prisma.product.findMany.mockResolvedValue([enStock]);
      await expect(
        service.attachProducts(manager, 'c1', { productIds: ['p1', 'pirate'] }),
      ).rejects.toThrow("n'appartient pas à votre entreprise");
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('refuse un produit déjà vendu, dont la commission est figée', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Sac vendu', status: { isSale: true, name: 'Vendu' } },
      ]);
      await expect(service.attachProducts(manager, 'c1', { productIds: ['p1'] })).rejects.toThrow(
        ConflictException,
      );
      await expect(service.attachProducts(manager, 'c1', { productIds: ['p1'] })).rejects.toThrow(
        'Sac vendu',
      );
    });
  });

  describe('detachProduct', () => {
    beforeEach(() => {
      prisma.depositContract.findFirst.mockResolvedValue({ ...contract, products: [] });
    });

    it('repasse le produit en achat-revente, référence inchangée', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', status: { isSale: false } });
      await service.detachProduct(manager, 'c1', 'p1');
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { depositContractId: null, saleType: 'RESALE', depositorPaid: null },
      });
      expect(products.nextReference).not.toHaveBeenCalled();
    });

    it('renumérote sur demande, en article acheté', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', status: { isSale: false } });
      products.nextReference.mockResolvedValue('A-0042');
      await service.detachProduct(manager, 'c1', 'p1', true);
      expect(products.nextReference).toHaveBeenCalledWith(
        expect.anything(),
        manager,
        'RESALE',
        null,
      );
      expect(prisma.product.update.mock.calls[0][0].data.reference).toBe('A-0042');
    });

    it('refuse un produit absent de ce contrat', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.detachProduct(manager, 'c1', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('refuse de détacher un produit vendu', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'p1', status: { isSale: true } });
      await expect(service.detachProduct(manager, 'c1', 'p1')).rejects.toThrow(
        'fausserait le relevé',
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });
});
