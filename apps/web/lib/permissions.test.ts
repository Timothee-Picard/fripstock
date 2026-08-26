import { describe, expect, it } from 'vitest';
import { hasPermission } from './permissions';
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
