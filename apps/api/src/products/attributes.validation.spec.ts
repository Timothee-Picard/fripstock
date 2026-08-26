import { BadRequestException } from '@nestjs/common';
import { normalizeValue, type ApplicableAttribute } from './attributes.validation';

const texte: ApplicableAttribute = { id: 'a1', name: 'Matière', type: 'TEXT', options: [] };
const nombre: ApplicableAttribute = { id: 'a2', name: 'Poids', type: 'NUMBER', options: [] };
const booleen: ApplicableAttribute = { id: 'a3', name: 'Doublé', type: 'BOOLEAN', options: [] };
const choix: ApplicableAttribute = {
  id: 'a4',
  name: 'Couleur',
  type: 'SELECT',
  options: [
    { id: 'o1', value: 'Noir' },
    { id: 'o2', value: 'Beige' },
  ],
};
const choixMultiple: ApplicableAttribute = {
  ...choix,
  id: 'a5',
  name: 'Tailles',
  type: 'MULTISELECT',
};

describe('normalizeValue', () => {
  describe('TEXT', () => {
    it('retient le texte débarrassé de ses espaces', () => {
      expect(normalizeValue(texte, '  cuir ')).toEqual({
        attributeDefinitionId: 'a1',
        optionIds: [],
        textValue: 'cuir',
      });
    });

    it('traite une chaîne vide comme une absence de valeur', () => {
      expect(normalizeValue(texte, '   ').textValue).toBeNull();
    });

    it('rejette ce qui n’est pas du texte', () => {
      expect(() => normalizeValue(texte, 42)).toThrow(BadRequestException);
      expect(() => normalizeValue(texte, 42)).toThrow('« Matière » attend du texte.');
    });
  });

  describe('NUMBER', () => {
    it('accepte un nombre', () => {
      expect(normalizeValue(nombre, 1.5).numberValue).toBe(1.5);
    });

    it('accepte une chaîne numérique, telle qu’envoyée par un formulaire', () => {
      expect(normalizeValue(nombre, '1.5').numberValue).toBe(1.5);
    });

    it('accepte zéro, qui est une valeur comme une autre', () => {
      expect(normalizeValue(nombre, 0).numberValue).toBe(0);
    });

    it.each([['pas un nombre'], [null], [true], [{}]])('rejette %p', (value) => {
      expect(() => normalizeValue(nombre, value)).toThrow('« Poids » attend un nombre.');
    });

    it('traite une chaîne vide comme une absence, et non comme un zéro', () => {
      expect(normalizeValue(nombre, '').numberValue).toBeNull();
      expect(normalizeValue(nombre, '   ').numberValue).toBeNull();
    });
  });

  describe('BOOLEAN', () => {
    it('accepte un booléen', () => {
      expect(normalizeValue(booleen, true).booleanValue).toBe(true);
      expect(normalizeValue(booleen, false).booleanValue).toBe(false);
    });

    it('accepte les chaînes « true » et « false » des formulaires', () => {
      expect(normalizeValue(booleen, 'true').booleanValue).toBe(true);
      expect(normalizeValue(booleen, 'false').booleanValue).toBe(false);
    });

    it.each([['oui'], [1], [null]])('rejette %p', (value) => {
      expect(() => normalizeValue(booleen, value)).toThrow('« Doublé » attend oui ou non.');
    });
  });

  describe('SELECT', () => {
    it('accepte l’identifiant d’une option', () => {
      expect(normalizeValue(choix, 'o1').optionIds).toEqual(['o1']);
    });

    it('accepte aussi le libellé de l’option', () => {
      expect(normalizeValue(choix, 'Beige').optionIds).toEqual(['o2']);
    });

    it('rejette une option inconnue en listant celles qui existent', () => {
      expect(() => normalizeValue(choix, 'Rouge')).toThrow(
        '« Couleur » attend une de ses options (Noir, Beige).',
      );
    });

    it('rejette ce qui n’est pas une chaîne', () => {
      expect(() => normalizeValue(choix, ['o1'])).toThrow('« Couleur » attend une option.');
    });
  });

  describe('MULTISELECT', () => {
    it('accepte une liste d’identifiants', () => {
      expect(normalizeValue(choixMultiple, ['o1', 'o2']).optionIds).toEqual(['o1', 'o2']);
    });

    it('accepte une valeur seule, sans tableau', () => {
      expect(normalizeValue(choixMultiple, 'o1').optionIds).toEqual(['o1']);
    });

    it('dédoublonne, y compris entre identifiant et libellé de la même option', () => {
      expect(normalizeValue(choixMultiple, ['o1', 'Noir', 'o1']).optionIds).toEqual(['o1']);
    });

    it('accepte une liste vide', () => {
      expect(normalizeValue(choixMultiple, []).optionIds).toEqual([]);
    });

    it('rejette dès qu’une option de la liste est inconnue', () => {
      expect(() => normalizeValue(choixMultiple, ['o1', 'Rouge'])).toThrow(
        '« Tailles » attend des options connues (Noir, Beige).',
      );
    });

    it('rejette un élément qui n’est pas une chaîne', () => {
      expect(() => normalizeValue(choixMultiple, [1])).toThrow(
        '« Tailles » attend une liste d’options.',
      );
    });
  });
});
