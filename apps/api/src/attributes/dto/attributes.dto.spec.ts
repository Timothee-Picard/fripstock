import { CreateAttributeDto, OptionDto } from './create-attribute.dto';
import { SetCategoriesDto } from './set-categories.dto';
import { SetOptionsDto } from './set-options.dto';
import { UpdateAttributeDto } from './update-attribute.dto';
import { isValid, validateDto } from '../../test/validate';

describe('DTO attributs', () => {
  describe('OptionDto', () => {
    it('accepte une option nouvelle, sans identifiant', () => {
      expect(isValid(OptionDto, { value: 'Noir' })).toBe(true);
    });

    it('refuse un libellé vide', () => {
      expect(validateDto(OptionDto, { value: '' }).errors).toContain('value');
    });
  });

  describe('CreateAttributeDto', () => {
    it('accepte un attribut texte sans option', () => {
      expect(isValid(CreateAttributeDto, { name: 'Matière', type: 'TEXT' })).toBe(true);
    });

    it('refuse un type inconnu', () => {
      expect(validateDto(CreateAttributeDto, { name: 'x', type: 'COULEUR' }).errors).toContain(
        'type',
      );
    });

    it('refuse deux options de même libellé', () => {
      expect(
        validateDto(CreateAttributeDto, {
          name: 'Couleur',
          type: 'SELECT',
          options: [{ value: 'Noir' }, { value: 'Noir' }],
        }).errors,
      ).toContain('options');
    });

    it('accepte des libellés distincts', () => {
      expect(
        isValid(CreateAttributeDto, {
          name: 'Couleur',
          type: 'SELECT',
          options: [{ value: 'Noir' }, { value: 'Beige' }],
        }),
      ).toBe(true);
    });
  });

  describe('SetOptionsDto', () => {
    it('exige la liste', () => {
      expect(validateDto(SetOptionsDto, {}).errors).toContain('options');
    });

    it('accepte un mélange d’options existantes et nouvelles', () => {
      expect(
        isValid(SetOptionsDto, { options: [{ id: 'o1', value: 'Noir' }, { value: 'Rouge' }] }),
      ).toBe(true);
    });
  });

  describe('SetCategoriesDto', () => {
    it('accepte une liste vide', () => {
      expect(isValid(SetCategoriesDto, { categoryIds: [] })).toBe(true);
    });

    it('refuse un doublon', () => {
      expect(validateDto(SetCategoriesDto, { categoryIds: ['c1', 'c1'] }).errors).toContain(
        'categoryIds',
      );
    });

    it('refuse autre chose que des chaînes', () => {
      expect(isValid(SetCategoriesDto, { categoryIds: [1] })).toBe(false);
    });
  });

  describe('UpdateAttributeDto', () => {
    it('exige un nom non vide', () => {
      expect(validateDto(UpdateAttributeDto, { name: '' }).errors).toContain('name');
    });
  });
});
