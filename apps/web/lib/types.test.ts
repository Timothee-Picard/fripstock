import { describe, expect, it } from 'vitest';
import {
  CONTRACT_STATUS_LABELS,
  PERMISSION_LABELS,
  COMPANY_PERMISSIONS,
  PERMISSIONS,
  SHOP_PERMISSIONS,
  SALE_TYPE_LABELS,
  TYPE_LABELS,
  daysUntil,
  euros,
  eurosNumber,
  flattenTree,
  readableAttributes,
  type CategoryTree,
  type Product,
} from './types';

describe('flattenTree', () => {
  const arbre: CategoryTree[] = [
    {
      id: 'v',
      name: 'Vêtements',
      parentId: null,
      children: [
        { id: 'r', name: 'Robe', parentId: 'v', children: [] },
        {
          id: 'h',
          name: 'Haut',
          parentId: 'v',
          children: [{ id: 'c', name: 'Chemise', parentId: 'h', children: [] }],
        },
      ],
    },
    { id: 's', name: 'Sac', parentId: null, children: [] },
  ];

  it('aplatit en profondeur d’abord, dans l’ordre de l’arbre', () => {
    expect(flattenTree(arbre).map((o) => o.id)).toEqual(['v', 'r', 'h', 'c', 's']);
  });

  it('indente les descendants pour que la hiérarchie reste lisible', () => {
    const libelles = flattenTree(arbre).map((o) => o.label);
    expect(libelles[0]).toBe('Vêtements');
    expect(libelles[1]).toContain('└ Robe');
    // Espaces insécables : sinon l'indentation disparaît dans une <option>.
    expect(libelles[3].startsWith('\u00a0\u00a0')).toBe(true);
    expect(libelles[3]).toContain('└ Chemise');
    // Le petit-enfant est indenté plus loin que l'enfant.
    expect(libelles[3].indexOf('└')).toBeGreaterThan(libelles[1].indexOf('└'));
  });

  it('rend une liste vide pour un arbre vide', () => {
    expect(flattenTree([])).toEqual([]);
  });
});

describe('readableAttributes', () => {
  const produit = (over: Partial<Product> = {}) =>
    ({ attributeValues: [], attributeOptions: [], ...over }) as Product;

  it('rend les valeurs simples, triées par nom d’attribut', () => {
    expect(
      readableAttributes(
        produit({
          attributeValues: [
            {
              attributeDefinitionId: 'a2',
              textValue: 'Cuir',
              numberValue: null,
              booleanValue: null,
              attribute: { id: 'a2', name: 'Matière', type: 'TEXT' },
            },
            {
              attributeDefinitionId: 'a1',
              textValue: 'Beige',
              numberValue: null,
              booleanValue: null,
              attribute: { id: 'a1', name: 'Couleur', type: 'TEXT' },
            },
          ],
        }),
      ),
    ).toEqual([
      { name: 'Couleur', value: 'Beige' },
      { name: 'Matière', value: 'Cuir' },
    ]);
  });

  it('traduit les booléens en Oui / Non', () => {
    const lire = (booleanValue: boolean | null) =>
      readableAttributes(
        produit({
          attributeValues: [
            {
              attributeDefinitionId: 'a1',
              textValue: null,
              numberValue: null,
              booleanValue,
              attribute: { id: 'a1', name: 'Doublé', type: 'BOOLEAN' },
            },
          ],
        }),
      );
    expect(lire(true)[0].value).toBe('Oui');
    expect(lire(false)[0].value).toBe('Non');
    expect(lire(null)).toEqual([]);
  });

  it('rend les nombres tels que l’API les renvoie', () => {
    expect(
      readableAttributes(
        produit({
          attributeValues: [
            {
              attributeDefinitionId: 'a1',
              textValue: null,
              numberValue: '1.5',
              booleanValue: null,
              attribute: { id: 'a1', name: 'Poids', type: 'NUMBER' },
            },
          ],
        }),
      )[0].value,
    ).toBe('1.5');
  });

  it('regroupe les options multiples sous un seul attribut', () => {
    const marque = { id: 'a1', name: 'Tailles', type: 'MULTISELECT' as const };
    expect(
      readableAttributes(
        produit({
          attributeOptions: [
            { option: { id: 'o1', value: 'S', attribute: marque } },
            { option: { id: 'o2', value: 'M', attribute: marque } },
          ],
        }),
      ),
    ).toEqual([{ name: 'Tailles', value: 'S, M' }]);
  });

  it('rend une liste vide pour un produit sans attribut', () => {
    expect(readableAttributes(produit())).toEqual([]);
  });
});

describe('euros', () => {
  it('formate avec deux décimales et la virgule française', () => {
    expect(euros('45')).toBe('45,00 €');
    expect(euros('45.5')).toBe('45,50 €');
  });

  it('affiche un tiret quand le prix n’est pas renseigné', () => {
    expect(euros(null)).toBe('—');
  });

  it('formate aussi un nombre déjà arrondi', () => {
    expect(eurosNumber(12.5)).toBe('12,50 €');
    expect(eurosNumber(0)).toBe('0,00 €');
  });
});

describe('daysUntil', () => {
  it('compte les jours restants', () => {
    const dans5 = new Date(Date.now() + 5 * 86400000).toISOString();
    expect(daysUntil(dans5)).toBe(5);
  });

  it('devient négatif une fois l’échéance passée', () => {
    const ilYa3 = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(daysUntil(ilYa3)).toBeLessThan(0);
  });
});

describe('périmètre des permissions', () => {
  it('partage toutes les permissions entre entreprise et boutique, sans reste', () => {
    // Une permission oubliée des deux listes disparaîtrait de l'écran des
    // accès : le gérant ne pourrait plus l'accorder, sans aucun message.
    expect([...COMPANY_PERMISSIONS, ...SHOP_PERMISSIONS].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('n’en met aucune dans les deux', () => {
    expect(SHOP_PERMISSIONS.filter((p) => COMPANY_PERMISSIONS.includes(p))).toEqual([]);
  });

  it('tient la liste des droits d’entreprise alignée avec l’API', () => {
    // Miroir de `COMPANY_PERMISSIONS` côté API. Les deux doivent bouger
    // ensemble : le garde suit la sienne, l'écran des accès la nôtre.
    expect([...COMPANY_PERMISSIONS]).toEqual([
      'categories.manage',
      'attributes.manage',
      'depositors.manage',
      'deposits.manage',
      'online.manage',
    ]);
  });
});

describe('libellés', () => {
  it('couvre toutes les permissions déclarées', () => {
    for (const p of PERMISSIONS) expect(PERMISSION_LABELS[p]).toBeTruthy();
  });

  it('couvre les deux modes de vente et les trois états de contrat', () => {
    expect(SALE_TYPE_LABELS.RESALE).toBe('Achat-revente');
    expect(SALE_TYPE_LABELS.CONSIGNMENT).toBe('Dépôt-vente');
    expect(Object.keys(CONTRACT_STATUS_LABELS)).toEqual(['ACTIVE', 'EXPIRED', 'CLOSED']);
  });

  it('couvre les cinq types d’attribut', () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(5);
  });
});
