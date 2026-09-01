import {
  COMPANY_PERMISSIONS,
  PERMISSIONS,
  isCompanyPermission,
  isValidPermission,
  readPermissions,
} from './permissions';

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

  describe('droits d’entreprise', () => {
    it.each([...COMPANY_PERMISSIONS])('%s vaut pour toute l’entreprise', (key) => {
      expect(isCompanyPermission(key)).toBe(true);
    });

    it.each(PERMISSIONS.filter((p) => !COMPANY_PERMISSIONS.has(p)))(
      '%s se règle boutique par boutique',
      (key) => {
        expect(isCompanyPermission(key)).toBe(false);
      },
    );

    it('ne contient que des clés déclarées', () => {
      // Une clé mal orthographiée n'y serait jamais reconnue, et le droit
      // redeviendrait silencieusement un droit de boutique.
      for (const key of COMPANY_PERMISSIONS) expect(isValidPermission(key)).toBe(true);
    });
  });
});
