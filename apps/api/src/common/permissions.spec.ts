import { PERMISSIONS, isValidPermission, readPermissions } from './permissions';

describe('permissions', () => {
  describe('isValidPermission', () => {
    it.each(PERMISSIONS)('accepte la clé connue %s', (key) => {
      expect(isValidPermission(key)).toBe(true);
    });

    it('rejette une clé inconnue', () => {
      expect(isValidPermission('products.voir')).toBe(false);
      expect(isValidPermission('')).toBe(false);
    });
  });

  describe('readPermissions', () => {
    it('ne garde que les clés connues explicitement à true', () => {
      expect(
        readPermissions({
          'products.view': true,
          'products.manage': false,
          'products.inventer': true,
        }),
      ).toEqual({ 'products.view': true });
    });

    it("traite une valeur qui n'est pas un objet comme aucun droit", () => {
      expect(readPermissions(null)).toEqual({});
      expect(readPermissions(undefined)).toEqual({});
      expect(readPermissions('products.view')).toEqual({});
      expect(readPermissions(42)).toEqual({});
    });

    it('ignore une valeur vraie non booléenne — seul `true` compte', () => {
      expect(readPermissions({ 'products.view': 1, 'products.manage': 'oui' })).toEqual({});
    });

    it('accepte un tableau, qui reste un objet sans clé connue', () => {
      expect(readPermissions(['products.view'])).toEqual({});
    });
  });
});
