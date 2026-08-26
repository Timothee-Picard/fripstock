import { ConflictException, NotFoundException } from '@nestjs/common';
import { DepositorsService } from './depositors.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, manager, sold } from '../test/fixtures';

const depositor = {
  id: 'dep-1',
  companyId: COMPANY_ID,
  lastName: 'Martin',
  firstName: 'Sophie',
  iban: 'FR76',
  defaultCommission: 40,
};

/** Un produit vendu, avec la commission figée au moment de la vente. */
const vendu = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'p1',
  reference: 'DEP1',
  name: 'Sac',
  soldAt: new Date('2026-08-20'),
  status: { id: sold.id, name: 'Vendu', color: '#000' },
  soldPrice: '100',
  appliedCommission: '40',
  depositorPaid: false,
  ...over,
});

describe('DepositorsService', () => {
  let prisma: PrismaMock;
  let service: DepositorsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DepositorsService(asPrisma(prisma));
  });

  describe('list', () => {
    it('trie par nom puis prénom et compte les contrats', async () => {
      prisma.depositor.findMany.mockResolvedValue([]);
      await service.list(manager);
      expect(prisma.depositor.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: { _count: { select: { contracts: true } } },
      });
    });
  });

  describe('detail', () => {
    it('rend le déposant et ses contrats', async () => {
      prisma.depositor.findFirst.mockResolvedValue({ ...depositor, contracts: [] });
      await expect(service.detail(manager, 'dep-1')).resolves.toBeDefined();
    });

    it("refuse un déposant d'une autre entreprise", async () => {
      prisma.depositor.findFirst.mockResolvedValue(null);
      await expect(service.detail(manager, 'dep-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it("force l'entreprise du jeton", async () => {
      prisma.depositor.create.mockResolvedValue(depositor);
      await service.create(manager, { lastName: 'Martin', defaultCommission: 30 });
      expect(prisma.depositor.create).toHaveBeenCalledWith({
        data: { lastName: 'Martin', defaultCommission: 30, companyId: COMPANY_ID },
      });
    });

    it('applique une commission par défaut de 0 si elle est absente', async () => {
      prisma.depositor.create.mockResolvedValue(depositor);
      await service.create(manager, { lastName: 'Martin' });
      expect(prisma.depositor.create).toHaveBeenCalledWith({
        data: { lastName: 'Martin', defaultCommission: 0, companyId: COMPANY_ID },
      });
    });
  });

  describe('update', () => {
    it("vérifie l'appartenance avant d'écrire", async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositor.update.mockResolvedValue(depositor);
      await service.update(manager, 'dep-1', { lastName: 'Durand' });
      expect(prisma.depositor.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { lastName: 'Durand' },
      });
    });

    it("n'écrit pas pour un déposant d'une autre entreprise", async () => {
      prisma.depositor.findFirst.mockResolvedValue(null);
      await expect(service.update(manager, 'dep-1', {})).rejects.toThrow(NotFoundException);
      expect(prisma.depositor.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('supprime un déposant sans contrat', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.count.mockResolvedValue(0);
      await expect(service.delete(manager, 'dep-1')).resolves.toEqual({ deleted: true });
    });

    it('refuse tant qu’un contrat existe', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.depositContract.count.mockResolvedValue(2);
      await expect(service.delete(manager, 'dep-1')).rejects.toThrow(ConflictException);
      expect(prisma.depositor.delete).not.toHaveBeenCalled();
    });
  });

  describe('products', () => {
    it('remonte par le contrat, faute de depositorId sur le produit', async () => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
      prisma.product.findMany.mockResolvedValue([]);
      await service.products(manager, 'dep-1');
      expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({
        depositContract: { depositorId: 'dep-1', depositor: { companyId: COMPANY_ID } },
      });
    });
  });

  describe('statement', () => {
    beforeEach(() => {
      prisma.depositor.findFirst.mockResolvedValue(depositor);
    });

    it('ne retient que les produits dont le statut porte isSale', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.statement(manager, 'dep-1');
      expect(prisma.product.findMany.mock.calls[0][0].where.status).toEqual({ isSale: true });
    });

    it('la commission est la part de la boutique, le reste va au déposant', async () => {
      prisma.product.findMany.mockResolvedValue([vendu()]);
      const { lines } = await service.statement(manager, 'dep-1');
      expect(lines[0].shopShare).toBe(40);
      expect(lines[0].depositorShare).toBe(60);
    });

    it('lit la commission figée sur le produit, jamais celle du contrat', async () => {
      // Le contrat pourrait dire 50 % aujourd'hui : le relevé garde 40 %.
      prisma.product.findMany.mockResolvedValue([vendu({ appliedCommission: '40' })]);
      const { lines } = await service.statement(manager, 'dep-1');
      expect(lines[0].commission).toBe(40);
    });

    it('traite une commission absente comme zéro : tout revient au déposant', async () => {
      prisma.product.findMany.mockResolvedValue([vendu({ appliedCommission: null })]);
      const { lines } = await service.statement(manager, 'dep-1');
      expect(lines[0].shopShare).toBe(0);
      expect(lines[0].depositorShare).toBe(100);
    });

    it('traite un prix vendu absent comme zéro', async () => {
      prisma.product.findMany.mockResolvedValue([vendu({ soldPrice: null })]);
      const { lines } = await service.statement(manager, 'dep-1');
      expect(lines[0].soldPrice).toBe(0);
      expect(lines[0].depositorShare).toBe(0);
    });

    it('arrondit à deux décimales', async () => {
      prisma.product.findMany.mockResolvedValue([
        vendu({ soldPrice: '33.33', appliedCommission: '33.33' }),
      ]);
      const { lines } = await service.statement(manager, 'dep-1');
      expect(lines[0].shopShare).toBe(11.11);
      expect(lines[0].depositorShare).toBe(22.22);
    });

    it('sépare ce qui est réglé de ce qui reste dû', async () => {
      prisma.product.findMany.mockResolvedValue([
        vendu({ id: 'p1', depositorPaid: true }),
        vendu({ id: 'p2', depositorPaid: false }),
      ]);
      const { totals } = await service.statement(manager, 'dep-1');
      expect(totals).toEqual({
        soldCount: 2,
        soldTotal: 200,
        shopShare: 80,
        depositorShare: 120,
        alreadyPaid: 60,
        outstanding: 60,
      });
    });

    it('considère un règlement non renseigné comme non réglé', async () => {
      prisma.product.findMany.mockResolvedValue([vendu({ depositorPaid: null })]);
      const { lines, totals } = await service.statement(manager, 'dep-1');
      expect(lines[0].depositorPaid).toBe(false);
      expect(totals.outstanding).toBe(60);
    });

    it('rend un relevé vide sans planter', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      const { totals } = await service.statement(manager, 'dep-1');
      expect(totals).toEqual({
        soldCount: 0,
        soldTotal: 0,
        shopShare: 0,
        depositorShare: 0,
        alreadyPaid: 0,
        outstanding: 0,
      });
    });

    it("rappelle l'IBAN, qui sert à faire le virement", async () => {
      prisma.product.findMany.mockResolvedValue([]);
      const releve = await service.statement(manager, 'dep-1');
      expect(releve.depositor.iban).toBe('FR76');
    });
  });
});
