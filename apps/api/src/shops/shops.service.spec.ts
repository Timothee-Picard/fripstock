import { ConflictException, NotFoundException } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, SHOP_ID, employee, manager } from '../test/fixtures';

describe('ShopsService', () => {
  let prisma: PrismaMock;
  let service: ShopsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ShopsService(asPrisma(prisma));
  });

  const shop = { id: SHOP_ID, companyId: COMPANY_ID, name: 'Centre-ville', address: null };

  describe('list', () => {
    it("ne filtre que sur l'entreprise pour un gérant", async () => {
      prisma.shop.findMany.mockResolvedValue([shop]);
      await service.list(manager);
      expect(prisma.shop.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        orderBy: { name: 'asc' },
      });
    });

    it('restreint un employé aux boutiques auxquelles il a accès', async () => {
      prisma.shop.findMany.mockResolvedValue([]);
      await service.list(employee);
      expect(prisma.shop.findMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_ID,
          accesses: { some: { userId: employee.userId } },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('detail', () => {
    it('rend la boutique trouvée', async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      await expect(service.detail(manager, SHOP_ID)).resolves.toBe(shop);
    });

    it("ajoute la contrainte d'accès pour un employé", async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      await service.detail(employee, SHOP_ID);
      expect(prisma.shop.findFirst).toHaveBeenCalledWith({
        where: {
          id: SHOP_ID,
          companyId: COMPANY_ID,
          accesses: { some: { userId: employee.userId } },
        },
      });
    });

    it("répond introuvable plutôt qu'interdit — ne pas révéler l'existence", async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.detail(manager, 'ailleurs')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it("force l'entreprise du jeton, jamais celle du corps de requête", async () => {
      prisma.shop.create.mockResolvedValue(shop);
      await service.create(manager, { name: 'Neuve', companyId: 'pirate' } as never);
      expect(prisma.shop.create).toHaveBeenCalledWith({
        data: { name: 'Neuve', companyId: COMPANY_ID },
      });
    });
  });

  describe('update', () => {
    it("vérifie l'appartenance avant d'écrire", async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      prisma.shop.update.mockResolvedValue({ ...shop, name: 'Renommée' });
      await service.update(manager, SHOP_ID, { name: 'Renommée' });
      expect(prisma.shop.findFirst).toHaveBeenCalledWith({
        where: { id: SHOP_ID, companyId: COMPANY_ID },
      });
      expect(prisma.shop.update).toHaveBeenCalledWith({
        where: { id: SHOP_ID },
        data: { name: 'Renommée' },
      });
    });

    it("n'écrit pas si la boutique appartient à une autre entreprise", async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.update(manager, SHOP_ID, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.shop.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('supprime une boutique vide', async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      prisma.product.count.mockResolvedValue(0);
      prisma.shop.delete.mockResolvedValue(shop);
      await expect(service.delete(manager, SHOP_ID)).resolves.toEqual({ deleted: true });
      expect(prisma.shop.delete).toHaveBeenCalledWith({ where: { id: SHOP_ID } });
    });

    it('refuse de supprimer une boutique qui contient du stock', async () => {
      prisma.shop.findFirst.mockResolvedValue(shop);
      prisma.product.count.mockResolvedValue(3);
      await expect(service.delete(manager, SHOP_ID)).rejects.toThrow(ConflictException);
      await expect(service.delete(manager, SHOP_ID)).rejects.toThrow('contient 3 produit(s)');
      expect(prisma.shop.delete).not.toHaveBeenCalled();
    });

    it("ne supprime pas la boutique d'une autre entreprise", async () => {
      prisma.shop.findFirst.mockResolvedValue(null);
      await expect(service.delete(manager, SHOP_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.product.count).not.toHaveBeenCalled();
      expect(prisma.shop.delete).not.toHaveBeenCalled();
    });
  });
});
