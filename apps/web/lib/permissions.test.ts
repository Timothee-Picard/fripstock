import { describe, expect, it } from 'vitest';
import { hasPermission, hasPermissionOnShop } from './permissions';
import type { Session, ShopAccess } from './types';

const acces = (over: Partial<ShopAccess> = {}): ShopAccess => ({
  shopId: 'b1',
  name: 'Centre-ville',
  allRights: false,
  permissions: [],
  ...over,
});

const session = (over: Partial<Session> = {}): Session => ({
  id: 'u1',
  email: 'a@b.fr',
  firstName: 'A',
  lastName: 'B',
  isManager: false,
  company: { id: 'e1', name: 'Friperie' },
  shops: [],
  ...over,
});

describe('hasPermission', () => {
  it('accorde tout au gérant, même sans boutique', () => {
    expect(hasPermission(session({ isManager: true }), 'products.delete')).toBe(true);
  });

  it('accorde à un employé la permission détenue sur une boutique', () => {
    expect(
      hasPermission(
        session({ shops: [acces({ permissions: ['products.view'] })] }),
        'products.view',
      ),
    ).toBe(true);
  });

  it('suffit de la détenir sur une seule boutique pour les écrans transverses', () => {
    expect(
      hasPermission(
        session({
          shops: [acces({ shopId: 'b1' }), acces({ shopId: 'b2', permissions: ['stats.view'] })],
        }),
        'stats.view',
      ),
    ).toBe(true);
  });

  it('refuse une permission que l’employé n’a nulle part', () => {
    expect(
      hasPermission(
        session({ shops: [acces({ permissions: ['products.view'] })] }),
        'products.delete',
      ),
    ).toBe(false);
  });

  it('refuse un employé sans aucune boutique', () => {
    expect(hasPermission(session(), 'products.view')).toBe(false);
  });

  it('honore le drapeau « tous les droits » porté par un accès', () => {
    expect(hasPermission(session({ shops: [acces({ allRights: true })] }), 'export.csv')).toBe(
      true,
    );
  });
});

describe('hasPermissionOnShop', () => {
  const caissierGare = session({
    shops: [
      acces({ shopId: 'b1', name: 'Centre-ville', permissions: ['products.view'] }),
      acces({ shopId: 'b2', name: 'Gare', permissions: ['products.changeStatus'] }),
    ],
  });

  it('accorde sur la boutique qui porte le droit', () => {
    expect(hasPermissionOnShop(caissierGare, 'products.changeStatus', 'b2')).toBe(true);
  });

  it('refuse sur une autre boutique, même si le droit existe ailleurs', () => {
    // C'est toute la différence avec `hasPermission` : tenir la caisse à la
    // Gare n'autorise pas à encaisser au Centre-ville, et l'API le refuserait.
    expect(hasPermissionOnShop(caissierGare, 'products.changeStatus', 'b1')).toBe(false);
  });

  it('refuse sur une boutique où l’employé n’a aucun accès', () => {
    expect(hasPermissionOnShop(caissierGare, 'products.changeStatus', 'b9')).toBe(false);
  });

  it('redevient « quelque part » sans boutique visée', () => {
    // Le comptoir cherche alors dans toutes ses boutiques, et l'API tranche
    // article par article.
    expect(hasPermissionOnShop(caissierGare, 'products.changeStatus')).toBe(true);
  });

  it('accorde tout au gérant, sur n’importe quelle boutique', () => {
    expect(hasPermissionOnShop(session({ isManager: true }), 'products.delete', 'b9')).toBe(true);
  });

  it('suit `allRights` sur la boutique visée', () => {
    const patron = session({ shops: [acces({ shopId: 'b1', allRights: true })] });
    expect(hasPermissionOnShop(patron, 'products.changeStatus', 'b1')).toBe(true);
  });
});
