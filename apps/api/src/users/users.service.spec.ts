import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, OTHER_SHOP_ID, SHOP_ID, manager } from '../test/fixtures';

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hash') }));
const hash = bcrypt.hash as unknown as jest.Mock;

describe('UsersService', () => {
  let prisma: PrismaMock;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(asPrisma(prisma));
    hash.mockReset().mockResolvedValue('hash');
  });

  describe('list', () => {
    it("scope sur l'entreprise et met les gérants en tête", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.list(manager);
      const args = prisma.user.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: COMPANY_ID });
      expect(args.orderBy).toEqual([{ isManager: 'desc' }, { lastName: 'asc' }]);
    });

    it('ne laisse jamais fuiter le hachage du mot de passe', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.list(manager);
      expect(prisma.user.findMany.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
    });
  });

  describe('invite', () => {
    const dto = { email: ' Employe@Test.FR ', firstName: 'Léa', lastName: 'Bernard' };
    const created = {
      id: 'u2',
      email: 'employe@test.fr',
      firstName: 'Léa',
      lastName: 'Bernard',
      isManager: false,
    };

    it('normalise l’email et crée un employé, jamais un gérant', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(created);
      await service.invite(manager, dto);
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.email).toBe('employe@test.fr');
      expect(data.isManager).toBe(false);
      expect(data.companyId).toBe(COMPANY_ID);
    });

    it('génère un mot de passe temporaire et le renvoie une seule fois', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(created);
      const resultat = await service.invite(manager, dto);
      expect(resultat.temporaryPassword).toEqual(expect.any(String));
      expect(resultat.temporaryPassword).not.toBe('');
      // Ce qui part en base est le hachage, pas le mot de passe.
      expect(hash).toHaveBeenCalledWith(resultat.temporaryPassword, 10);
      expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBe('hash');
    });

    it('ne renvoie pas de mot de passe quand le gérant en fournit un', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(created);
      const resultat = await service.invite(manager, { ...dto, password: 'choisi' });
      expect(resultat.temporaryPassword).toBeUndefined();
      expect(hash).toHaveBeenCalledWith('choisi', 10);
    });

    it('refuse un email déjà utilisé', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'autre' });
      await expect(service.invite(manager, dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('setAccess', () => {
    const employe = { id: 'u2', isManager: false };

    it('remplace les accès et stocke les permissions au format base', async () => {
      prisma.user.findFirst.mockResolvedValue(employe);
      prisma.shop.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([{ id: 'u2' }]);

      await service.setAccess(manager, 'u2', {
        accesses: [{ shopId: SHOP_ID, permissions: ['products.view'] }],
      });

      expect(prisma.shopAccess.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });
      expect(prisma.shopAccess.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'u2', shopId: SHOP_ID, permissions: { 'products.view': true } }],
      });
    });

    it('accepte une liste vide, qui retire tous les accès', async () => {
      prisma.user.findFirst.mockResolvedValue(employe);
      prisma.shop.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([{ id: 'u2' }]);
      await service.setAccess(manager, 'u2', { accesses: [] });
      expect(prisma.shopAccess.deleteMany).toHaveBeenCalled();
      expect(prisma.shopAccess.createMany).not.toHaveBeenCalled();
    });

    it('refuse deux fois la même boutique', async () => {
      prisma.user.findFirst.mockResolvedValue(employe);
      await expect(
        service.setAccess(manager, 'u2', {
          accesses: [
            { shopId: SHOP_ID, permissions: [] },
            { shopId: SHOP_ID, permissions: ['products.view'] },
          ],
        }),
      ).rejects.toThrow('plusieurs fois');
    });

    it("refuse une boutique d'une autre entreprise", async () => {
      prisma.user.findFirst.mockResolvedValue(employe);
      prisma.shop.count.mockResolvedValue(1);
      await expect(
        service.setAccess(manager, 'u2', {
          accesses: [
            { shopId: SHOP_ID, permissions: [] },
            { shopId: OTHER_SHOP_ID, permissions: [] },
          ],
        }),
      ).rejects.toThrow("n'appartient pas à cette entreprise");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuse d'agir sur un gérant", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', isManager: true });
      await expect(service.setAccess(manager, 'u1', { accesses: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("refuse un utilisateur d'une autre entreprise", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.setAccess(manager, 'u9', { accesses: [] })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('supprime un employé de son entreprise', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u2', isManager: false });
      await expect(service.delete(manager, 'u2')).resolves.toEqual({ deleted: true });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
    });

    it('refuse de supprimer un gérant par cette route', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', isManager: true });
      await expect(service.delete(manager, 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
