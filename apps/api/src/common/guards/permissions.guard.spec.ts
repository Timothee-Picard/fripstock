import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLE_SOURCE_BOUTIQUE, type SourceBoutique } from '../decorators/boutique-source.decorator';
import { CLE_PERMISSION } from '../decorators/require-permission.decorator';
import type { Permission } from '../permissions';
import type { UtilisateurCourant } from '../types/utilisateur-courant';
import { PermissionsGuard } from './permissions.guard';

/** Forme du `where` que le guard doit construire — c'est ce qu'on vérifie. */
interface ArgsAccesBoutique {
  where: {
    userId: string;
    boutiqueId: string;
    boutique: { entrepriseId: string };
  };
  select?: unknown;
}

/**
 * Aucune route n'exige encore de permission fine — les produits arrivent à
 * l'étape 5. Ces tests couvrent donc directement le guard, parce que c'est lui
 * qui décide de tous les accès employés du reste de l'application.
 */
describe('PermissionsGuard', () => {
  const EMPLOYE: UtilisateurCourant = {
    userId: 'u1',
    entrepriseId: 'e1',
    estGerant: false,
  };
  const GERANT: UtilisateurCourant = { ...EMPLOYE, estGerant: true };

  function contexte(requete: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => requete }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  function monter(options: {
    permission?: Permission;
    source?: SourceBoutique;
    accesTrouve?: { permissions: unknown } | null;
    compteStockCentral?: number;
  }) {
    const reflector = {
      getAllAndOverride: (cle: string) =>
        cle === CLE_PERMISSION
          ? options.permission
          : cle === CLE_SOURCE_BOUTIQUE
            ? options.source
            : undefined,
    } as unknown as Reflector;

    // Typage explicite du mock : sans lui, `mock.calls[0][0]` est un `any` et
    // les assertions ci-dessous passeraient même si la forme du where changeait.
    const findFirst = jest
      .fn<Promise<unknown>, [ArgsAccesBoutique]>()
      .mockResolvedValue(options.accesTrouve ?? null);
    const count = jest
      .fn<Promise<number>, [unknown]>()
      .mockResolvedValue(options.compteStockCentral ?? 0);
    const prisma = { accesBoutique: { findFirst, count } };
    return { guard: new PermissionsGuard(reflector, prisma as never), findFirst, count };
  }

  it('laisse passer une route sans permission exigée', async () => {
    const { guard } = monter({});
    await expect(guard.canActivate(contexte({ user: EMPLOYE }))).resolves.toBe(true);
  });

  it('laisse toujours passer le gérant, sans lire la table des accès', async () => {
    const { guard, findFirst } = monter({ permission: 'produits.creer' });
    await expect(guard.canActivate(contexte({ user: GERANT }))).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('accepte un employé qui a la permission sur la boutique visée', async () => {
    const { guard } = monter({
      permission: 'produits.creer',
      accesTrouve: { permissions: { 'produits.creer': true } },
    });
    const ctx = contexte({ user: EMPLOYE, params: { boutiqueId: 'b1' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('refuse un employé qui a un accès à la boutique mais pas cette permission', async () => {
    const { guard } = monter({
      permission: 'produits.supprimer',
      accesTrouve: { permissions: { 'produits.voir': true } },
    });
    const ctx = contexte({ user: EMPLOYE, params: { boutiqueId: 'b1' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it("refuse quand l'employé n'a aucun accès à la boutique visée", async () => {
    const { guard } = monter({ permission: 'produits.voir', accesTrouve: null });
    const ctx = contexte({ user: EMPLOYE, params: { boutiqueId: 'autre' }, body: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('scope la recherche sur l’entreprise de l’utilisateur, pas sur le seul boutiqueId', async () => {
    const { guard, findFirst } = monter({
      permission: 'produits.voir',
      accesTrouve: { permissions: { 'produits.voir': true } },
    });
    await guard.canActivate(
      contexte({ user: EMPLOYE, params: { boutiqueId: 'b1' }, body: {}, query: {} }),
    );
    expect(findFirst.mock.calls[0][0].where.boutique).toEqual({ entrepriseId: 'e1' });
  });

  it('lit boutiqueId depuis le body quand il n’est pas dans les params', async () => {
    const { guard, findFirst } = monter({
      permission: 'produits.creer',
      accesTrouve: { permissions: { 'produits.creer': true } },
    });
    await guard.canActivate(
      contexte({ user: EMPLOYE, params: {}, body: { boutiqueId: 'depuis-body' }, query: {} }),
    );
    expect(findFirst.mock.calls[0][0].where.boutiqueId).toBe('depuis-body');
  });

  describe('stock central (aucune boutique visée)', () => {
    it('accepte si la permission est détenue sur au moins une boutique', async () => {
      const { guard } = monter({ permission: 'produits.creer', compteStockCentral: 1 });
      const ctx = contexte({ user: EMPLOYE, params: {}, body: {}, query: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('refuse si la permission n’est détenue nulle part', async () => {
      const { guard } = monter({ permission: 'produits.creer', compteStockCentral: 0 });
      const ctx = contexte({ user: EMPLOYE, params: {}, body: {}, query: {} });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('boutique déduite d’une ressource (@BoutiqueDepuisRessource)', () => {
    it('interroge le résolveur avec l’entreprise de l’utilisateur', async () => {
      const resolveur = jest.fn().mockResolvedValue('b-du-produit');
      const { guard, findFirst } = monter({
        permission: 'produits.changerStatut',
        source: { param: 'id', resolveur },
        accesTrouve: { permissions: { 'produits.changerStatut': true } },
      });
      await guard.canActivate(
        contexte({ user: EMPLOYE, params: { id: 'p1' }, body: {}, query: {} }),
      );
      expect(resolveur).toHaveBeenCalledWith(expect.anything(), 'p1', 'e1');
      expect(findFirst.mock.calls[0][0].where.boutiqueId).toBe('b-du-produit');
    });

    it('bascule sur la règle du stock central si la ressource n’a pas de boutique', async () => {
      const { guard } = monter({
        permission: 'produits.modifier',
        source: { param: 'id', resolveur: jest.fn().mockResolvedValue(null) },
        compteStockCentral: 1,
      });
      const ctx = contexte({ user: EMPLOYE, params: { id: 'p1' }, body: {}, query: {} });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });
});
