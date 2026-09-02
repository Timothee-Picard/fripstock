import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

// bcryptjs expose des propriétés non redéfinissables : `jest.spyOn` échoue
// dessus, il faut remplacer le module entier.
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hash-neuf'),
  compare: jest.fn().mockResolvedValue(true),
}));

const compare = bcrypt.compare as unknown as jest.Mock;
const hash = bcrypt.hash as unknown as jest.Mock;
import { PERMISSIONS } from '../common/permissions';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, SHOP_ID, employee, manager } from '../test/fixtures';

describe('AuthService', () => {
  let prisma: PrismaMock;
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  const user = {
    id: manager.userId,
    companyId: COMPANY_ID,
    email: 'gerant@test.fr',
    passwordHash: 'hash',
    firstName: 'Camille',
    lastName: 'Durand',
    isManager: true,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn().mockResolvedValue('jeton') };
    service = new AuthService(asPrisma(prisma), jwt as unknown as JwtService);
  });

  beforeEach(() => {
    compare.mockReset().mockResolvedValue(true);
    hash.mockReset().mockResolvedValue('hash-neuf');
  });

  describe('register', () => {
    const dto = {
      companyName: 'Friperie',
      email: '  Gerant@Test.FR ',
      password: 'secret',
      firstName: 'Camille',
      lastName: 'Durand',
    };

    function arrangeTransaction() {
      prisma.company.create.mockResolvedValue({ id: COMPANY_ID });
      prisma.status.findMany.mockResolvedValue([
        { id: 's1', name: 'En stock' },
        { id: 's2', name: 'En rayon' },
        { id: 's3', name: 'Réservé' },
        { id: 's4', name: 'Vendu' },
        { id: 's5', name: 'Rendu au client' },
        { id: 's6', name: 'Retiré' },
      ]);
      prisma.user.create.mockResolvedValue(user);
      // Le catalogue de départ est posé dans la même transaction.
      prisma.attributeTemplate.findMany.mockResolvedValue([]);
      prisma.attributeDefinition.create.mockResolvedValue({ id: 'attr-1' });
      prisma.category.create.mockResolvedValue({ id: 'cat-1' });
    }

    it('normalise l’email avant de vérifier le doublon et de créer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      arrangeTransaction();
      await service.register(dto);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'gerant@test.fr' },
        select: { id: true },
      });
      expect(prisma.user.create.mock.calls[0][0].data.email).toBe('gerant@test.fr');
    });

    it('refuse un email déjà utilisé', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'autre' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('crée les statuts de base et leur flux de départ', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      arrangeTransaction();
      await service.register(dto);
      expect(prisma.status.createMany).toHaveBeenCalled();
      const statuts = prisma.status.createMany.mock.calls[0][0].data;
      expect(statuts).toHaveLength(7);
      expect(statuts.map((s: { position: number }) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(prisma.statusTransition.createMany.mock.calls[0][0].data.length).toBeGreaterThan(0);
    });

    it('pose le catalogue de départ, scopé sur la nouvelle entreprise', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      arrangeTransaction();
      await service.register(dto);
      // Un compte neuf arrivait sur un catalogue vide : la première création de
      // produit obligeait à inventer catégories et attributs d'abord.
      expect(prisma.attributeDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: COMPANY_ID }),
        }),
      );
      expect(prisma.category.create).toHaveBeenCalled();
      expect(prisma.category.create.mock.calls[0][0].data.companyId).toBe(COMPANY_ID);
    });

    it('fait du créateur le gérant de son entreprise', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      arrangeTransaction();
      await service.register(dto);
      expect(prisma.user.create.mock.calls[0][0].data.isManager).toBe(true);
    });

    it('hache le mot de passe, jamais stocké en clair', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      arrangeTransaction();
      await service.register(dto);
      expect(hash).toHaveBeenCalledWith('secret', 10);
      expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBe('hash-neuf');
    });

    it('rend un jeton et l’utilisateur', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      arrangeTransaction();
      await expect(service.register(dto)).resolves.toEqual({
        accessToken: 'jeton',
        user: { id: user.id, companyId: COMPANY_ID, isManager: true },
      });
    });
  });

  describe('login', () => {
    it('accepte le bon mot de passe et signe un jeton', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      compare.mockResolvedValue(true);
      await expect(service.login({ email: 'gerant@test.fr', password: 'secret' })).resolves.toEqual(
        { accessToken: 'jeton', user: { id: user.id, companyId: COMPANY_ID, isManager: true } },
      );
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        companyId: COMPANY_ID,
        isManager: true,
      });
    });

    it('normalise l’email de connexion', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      compare.mockResolvedValue(true);
      await service.login({ email: ' Gerant@Test.FR ', password: 'secret' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'gerant@test.fr' } });
    });

    it('refuse un mot de passe faux', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      compare.mockResolvedValue(false);
      await expect(service.login({ email: 'gerant@test.fr', password: 'faux' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('donne le même message pour un email inconnu — ne pas énumérer les comptes', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      compare.mockResolvedValue(false);
      await expect(service.login({ email: 'inconnu@test.fr', password: 'x' })).rejects.toThrow(
        'Email ou mot de passe incorrect.',
      );
      // Un hachage est fait quand même, pour que la réponse mette le même temps.
      expect(compare).toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('rend le profil et les accès boutique', async () => {
      prisma.user.findFirst.mockResolvedValue({
        ...user,
        company: { id: COMPANY_ID, name: 'Friperie' },
      });
      prisma.shop.findMany.mockResolvedValue([{ id: SHOP_ID, name: 'Centre-ville' }]);
      const profil = await service.me(manager);
      expect(profil.company.name).toBe('Friperie');
      expect(profil.shops).toHaveLength(1);
    });

    it("scope la requête sur l'entreprise du jeton", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...user, company: {} });
      prisma.shop.findMany.mockResolvedValue([]);
      await service.me(manager);
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({
        id: manager.userId,
        companyId: COMPANY_ID,
      });
    });

    it('refuse proprement un jeton dont le compte a disparu', async () => {
      // Employé supprimé, base restaurée : le jeton reste valide mais ne
      // désigne plus personne. Un 500 ferait planter l'écran au lieu de
      // ramener à la connexion.
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.me(manager)).rejects.toThrow('Session expirée. Reconnectez-vous.');
    });
  });

  describe('shopAccesses', () => {
    it('donne au gérant toutes les boutiques avec tous les droits', async () => {
      prisma.shop.findMany.mockResolvedValue([
        { id: SHOP_ID, name: 'Centre-ville' },
        { id: 'shop-2', name: 'Gare' },
      ]);
      const acces = await service.shopAccesses(manager);
      expect(acces).toHaveLength(2);
      expect(acces[0].allRights).toBe(true);
      expect(acces[0].permissions).toEqual([...PERMISSIONS]);
      expect(prisma.shopAccess.findMany).not.toHaveBeenCalled();
    });

    it("ne donne à l'employé que ses boutiques et ses permissions", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([
        {
          shopId: SHOP_ID,
          permissions: { 'products.view': true, 'products.delete': false },
          shop: { name: 'Centre-ville' },
        },
      ]);
      const acces = await service.shopAccesses(employee);
      expect(acces).toEqual([
        {
          shopId: SHOP_ID,
          name: 'Centre-ville',
          allRights: false,
          permissions: ['products.view'],
        },
      ]);
    });

    it("ne remonte pas les accès à une boutique d'une autre entreprise", async () => {
      prisma.shopAccess.findMany.mockResolvedValue([]);
      await service.shopAccesses(employee);
      expect(prisma.shopAccess.findMany.mock.calls[0][0].where).toEqual({
        userId: employee.userId,
        shop: { companyId: COMPANY_ID },
      });
    });
  });

  describe('updateProfile', () => {
    const dto = { firstName: 'Camille', lastName: 'Durand', email: 'gerant@test.fr' };

    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue({
        ...user,
        company: { id: COMPANY_ID, name: 'Friperie' },
      });
      prisma.shop.findMany.mockResolvedValue([]);
    });

    it('refuse proprement un jeton dont le compte a disparu', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.updateProfile(manager, dto)).rejects.toThrow('Session expirée');
    });

    it("n'exige pas le mot de passe quand l'email ne change pas", async () => {
      await service.updateProfile(manager, dto);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("exige le mot de passe actuel pour changer d'email", async () => {
      await expect(
        service.updateProfile(manager, { ...dto, email: 'neuf@test.fr' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuse un mot de passe actuel faux', async () => {
      compare.mockResolvedValue(false);
      await expect(
        service.updateProfile(manager, {
          ...dto,
          email: 'neuf@test.fr',
          currentPassword: 'faux',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuse un email déjà pris par un autre compte', async () => {
      compare.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue({ id: 'autre' });
      await expect(
        service.updateProfile(manager, {
          ...dto,
          email: 'neuf@test.fr',
          currentPassword: 'secret',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("accepte le changement d'email quand tout est bon", async () => {
      compare.mockResolvedValue(true);
      prisma.user.findUnique.mockResolvedValue(null);
      await service.updateProfile(manager, {
        ...dto,
        email: ' Neuf@Test.FR ',
        currentPassword: 'secret',
      });
      expect(prisma.user.update.mock.calls[0][0].data.email).toBe('neuf@test.fr');
    });

    it("ne considère pas un simple changement de casse comme un changement d'email", async () => {
      await service.updateProfile(manager, { ...dto, email: 'GERANT@TEST.FR' });
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue(user);
    });

    it('refuse proprement un jeton dont le compte a disparu', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.changePassword(manager, { currentPassword: 'x', newPassword: 'motdepasse' }),
      ).rejects.toThrow('Session expirée');
    });

    it("exige l'ancien mot de passe", async () => {
      compare.mockResolvedValue(false);
      await expect(
        service.changePassword(manager, { currentPassword: 'faux', newPassword: 'neuf' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuse un nouveau mot de passe identique à l’ancien', async () => {
      compare.mockResolvedValue(true);
      await expect(
        service.changePassword(manager, { currentPassword: 'secret', newPassword: 'secret' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('remplace le hachage et rend un jeton neuf', async () => {
      compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await expect(
        service.changePassword(manager, { currentPassword: 'secret', newPassword: 'neuf' }),
      ).resolves.toMatchObject({ accessToken: 'jeton' });
      expect(hash).toHaveBeenCalledWith('neuf', 10);
      expect(prisma.user.update.mock.calls[0][0].data.passwordHash).toBe('hash-neuf');
    });
  });
  describe('accountSummary', () => {
    beforeEach(() => {
      prisma.company.findFirst.mockResolvedValue({ name: 'Friperie' });
      prisma.shop.count.mockResolvedValue(3);
      prisma.user.count.mockResolvedValue(2);
      prisma.product.count.mockResolvedValue(128);
      prisma.depositor.count.mockResolvedValue(4);
      prisma.depositContract.count.mockResolvedValue(6);
    });

    it('chiffre ce que la suppression emporterait', async () => {
      await expect(service.accountSummary(manager)).resolves.toEqual({
        companyName: 'Friperie',
        shops: 3,
        employees: 2,
        products: 128,
        depositors: 4,
        contracts: 6,
      });
    });

    it('ne compte pas le gérant parmi les employés', async () => {
      await service.accountSummary(manager);
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, isManager: false },
      });
    });

    it('scope les contrats via leur déposant, qui porte seul le companyId', async () => {
      await service.accountSummary(manager);
      expect(prisma.depositContract.count).toHaveBeenCalledWith({
        where: { depositor: { companyId: COMPANY_ID } },
      });
    });

    it('refuse proprement un jeton dont l’entreprise a disparu', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.accountSummary(manager)).rejects.toThrow('Session expirée');
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue(user);
      prisma.category.deleteMany.mockResolvedValue({ count: 0 });
    });

    it('refuse proprement un jeton dont le compte a disparu', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.deleteAccount(manager, { password: 'secret' })).rejects.toThrow(
        'Session expirée',
      );
      expect(prisma.company.delete).not.toHaveBeenCalled();
    });

    it('exige le mot de passe : une session ouverte ne suffit pas', async () => {
      compare.mockResolvedValue(false);
      await expect(service.deleteAccount(manager, { password: 'faux' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.company.delete).not.toHaveBeenCalled();
    });

    it('supprime les produits avant les catégories, elles-mêmes avant l’entreprise', async () => {
      const ordre: string[] = [];
      prisma.product.deleteMany.mockImplementation(() => {
        ordre.push('produits');
        return Promise.resolve({ count: 12 });
      });
      prisma.category.deleteMany.mockImplementation(() => {
        ordre.push('catégories');
        return Promise.resolve({ count: 0 });
      });
      prisma.company.delete.mockImplementation(() => {
        ordre.push('entreprise');
        return Promise.resolve({});
      });

      await expect(service.deleteAccount(manager, { password: 'secret' })).resolves.toEqual({
        deleted: true,
      });
      // Catégorie et statut d'un produit sont en `Restrict` : une cascade
      // partie de l'entreprise buterait dessus.
      expect(ordre).toEqual(['produits', 'catégories', 'entreprise']);
    });

    it('vide l’arbre des catégories des feuilles vers la racine', async () => {
      // `parentId` est en `Restrict` et Postgres le vérifie ligne à ligne : il
      // faut redescendre d'un niveau tant qu'il en tombe.
      prisma.category.deleteMany
        .mockResolvedValueOnce({ count: 8 })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await service.deleteAccount(manager, { password: 'secret' });

      expect(prisma.category.deleteMany).toHaveBeenCalledTimes(3);
      expect(prisma.category.deleteMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, children: { none: {} } },
      });
      expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: COMPANY_ID } });
    });

    it("ne touche qu'à l'entreprise du jeton", async () => {
      await service.deleteAccount(manager, { password: 'secret' });
      expect(prisma.product.deleteMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
      });
    });
  });
});
