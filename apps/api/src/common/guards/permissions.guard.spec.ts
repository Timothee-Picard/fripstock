import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SHOP_SOURCE_KEY, type ShopSource } from '../decorators/shop-source.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { Permission } from '../permissions';
import type { CurrentUser } from '../types/current-user';
import { PermissionsGuard } from './permissions.guard';

/** Forme du `where` que le guard doit construire — c'est ce qu'on vérifie. */
interface ArgsAccessShop {
  where: {
    userId: string;
    shopId: string;
    shop: { companyId: string };
  };
  select?: unknown;
}

/**
 * Aucune route n'exige encore de permission fine — les produits arrivent à
 * l'étape 5. Ces tests couvrent donc directement le guard, parce que c'est lui
 * qui décide de tous les accès employés du reste de l'application.
 */
describe('PermissionsGuard', () => {
  const EMPLOYEE: CurrentUser = {
    userId: 'u1',
    companyId: 'e1',
    isManager: false,
  };
  const GERANT: CurrentUser = { ...EMPLOYEE, isManager: true };

  function contexte(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  function mount(options: {
    permission?: Permission;
    source?: ShopSource;
    accesTrouve?: { permissions: unknown } | null;
    compteStockCentral?: number;
  }) {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PERMISSION_KEY
          ? options.permission
          : key === SHOP_SOURCE_KEY
            ? options.source
            : undefined,
    } as unknown as Reflector;

    // Typage explicite du mock : sans lui, `mock.calls[0][0]` est un `any` et
    // les assertions ci-dessous passeraient même si la forme du where changeait.
    const findFirst = jest
      .fn<Promise<unknown>, [ArgsAccessShop]>()
      .mockResolvedValue(options.accesTrouve ?? null);
    const count = jest
      .fn<Promise<number>, [unknown]>()
      .mockResolvedValue(options.compteStockCentral ?? 0);
    const prisma = { shopAccess: { findFirst, count } };
    return { guard: new PermissionsGuard(reflector, prisma as never), findFirst, count };
  }

  it('laisse passer une route sans permission exigée', async () => {
    const { guard } = mount({});
    await expect(guard.canActivate(contexte({ user: EMPLOYEE }))).resolves.toBe(true);
  });

  it('laisse toujours passer le gérant, sans lire la table des accès', async () => {
    const { guard, findFirst } = mount({ permission: 'products.create' });
    await expect(guard.canActivate(contexte({ user: GERANT }))).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('accepte un employé qui a la permission sur la boutique visée', async () => {
    const { guard } = mount({
      permission: 'products.create',
      accesTrouve: { permissions: { 'products.create': true } },
    });
    const ctx = contexte({ user: EMPLOYEE, params: { shopId: 'b1' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('refuse un employé qui a un accès à la boutique mais pas cette permission', async () => {
    const { guard } = mount({
      permission: 'products.delete',
      accesTrouve: { permissions: { 'products.view': true } },
    });
    const ctx = contexte({ user: EMPLOYEE, params: { shopId: 'b1' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it("refuse quand l'employé n'a aucun accès à la boutique visée", async () => {
    const { guard } = mount({ permission: 'products.view', accesTrouve: null });
    const ctx = contexte({ user: EMPLOYEE, params: { shopId: 'autre' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('scope la recherche sur l’entreprise de l’utilisateur, pas sur le seul shopId', async () => {
    const { guard, findFirst } = mount({
      permission: 'products.view',
      accesTrouve: { permissions: { 'products.view': true } },
    });
    await guard.canActivate(
      contexte({ user: EMPLOYEE, params: { shopId: 'b1' }, body: {}, query: {} }),
    );
    expect(findFirst.mock.calls[0][0].where.shop).toEqual({ companyId: 'e1' });
  });

  it('lit shopId depuis le body quand il n’est pas dans les params', async () => {
    const { guard, findFirst } = mount({
      permission: 'products.create',
      accesTrouve: { permissions: { 'products.create': true } },
    });
    await guard.canActivate(
      contexte({ user: EMPLOYEE, params: {}, body: { shopId: 'depuis-body' }, query: {} }),
    );
    expect(findFirst.mock.calls[0][0].where.shopId).toBe('depuis-body');
  });

  describe('stock central (aucune boutique visée)', () => {
    it('accepte si la permission est détenue sur au moins une boutique', async () => {
      const { guard } = mount({ permission: 'products.create', compteStockCentral: 1 });
      const ctx = contexte({ user: EMPLOYEE, params: {}, body: {}, query: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('refuse si la permission n’est détenue nulle part', async () => {
      const { guard } = mount({ permission: 'products.create', compteStockCentral: 0 });
      const ctx = contexte({ user: EMPLOYEE, params: {}, body: {}, query: {} });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('boutique déduite d’une ressource (@ShopFromResource)', () => {
    it('interroge le résolveur avec l’entreprise de l’utilisateur', async () => {
      const resolver = jest.fn().mockResolvedValue('b-du-product');
      const { guard, findFirst } = mount({
        permission: 'products.changeStatus',
        source: { param: 'id', resolver },
        accesTrouve: { permissions: { 'products.changeStatus': true } },
      });
      await guard.canActivate(
        contexte({ user: EMPLOYEE, params: { id: 'p1' }, body: {}, query: {} }),
      );
      expect(resolver).toHaveBeenCalledWith(expect.anything(), 'p1', 'e1');
      expect(findFirst.mock.calls[0][0].where.shopId).toBe('b-du-product');
    });

    it('bascule sur la règle du stock central si la ressource n’a pas de boutique', async () => {
      const { guard } = mount({
        permission: 'products.update',
        source: { param: 'id', resolver: jest.fn().mockResolvedValue(null) },
        compteStockCentral: 1,
      });
      const ctx = contexte({ user: EMPLOYEE, params: { id: 'p1' }, body: {}, query: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('cas limites', () => {
    it("refuse une requête sans utilisateur : le guard JWT n'a pas dû passer", async () => {
      const { guard } = mount({ permission: 'products.view' });
      await expect(guard.canActivate(contexte({}))).rejects.toThrow('Authentification requise.');
    });

    it('retombe sur le stock central quand le paramètre de route est absent', async () => {
      const resolver = jest.fn();
      const { guard } = mount({
        permission: 'products.view',
        source: { param: 'id', resolver },
        compteStockCentral: 1,
      });
      await expect(guard.canActivate(contexte({ user: EMPLOYEE, params: {} }))).resolves.toBe(true);
      expect(resolver).not.toHaveBeenCalled();
    });

    it("retombe sur le stock central quand la ressource n'a pas de boutique", async () => {
      const { guard } = mount({
        permission: 'products.view',
        source: { param: 'id', resolver: jest.fn().mockResolvedValue(undefined) },
        compteStockCentral: 1,
      });
      await expect(
        guard.canActivate(contexte({ user: EMPLOYEE, params: { id: 'p1' } })),
      ).resolves.toBe(true);
    });
  });
});
