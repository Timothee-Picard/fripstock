import { AssignShopDto } from './assign-shop.dto';
import { ValueAttributeDto } from './attribute-value.dto';
import { ChangeStatusDto } from './change-status.dto';
import { CreateLotDto } from './create-lot.dto';
import { CreateProductDto } from './create-product.dto';
import { DepositorPaymentDto } from './depositor-payment.dto';
import { FilterProductsDto } from './filter-products.dto';
import { UpdateProductDto } from './update-product.dto';
import { UpdateSaleDto } from './update-sale.dto';
import { isValid, validateDto } from '../../test/validate';

const minimal = { name: 'Sac', categoryId: 'c1', saleType: 'RESALE' };

describe('DTO produits', () => {
  describe('CreateProductDto', () => {
    it('accepte le strict nécessaire', () => {
      expect(isValid(CreateProductDto, minimal)).toBe(true);
    });

    it.each([
      ['un nom vide', { ...minimal, name: '' }, 'name'],
      ['un nom trop long', { ...minimal, name: 'x'.repeat(201) }, 'name'],
      ['un type de vente inconnu', { ...minimal, saleType: 'TROC' }, 'saleType'],
      ['une quantité nulle', { ...minimal, quantity: 0 }, 'quantity'],
      ['une quantité décimale', { ...minimal, quantity: 1.5 }, 'quantity'],
      ['un prix négatif', { ...minimal, salePrice: -1 }, 'salePrice'],
      ['un prix à trois décimales', { ...minimal, salePrice: 1.234 }, 'salePrice'],
      ['une date de vente qui n’en est pas une', { ...minimal, soldAt: 'hier' }, 'soldAt'],
      ['une référence trop longue', { ...minimal, reference: 'x'.repeat(61) }, 'reference'],
    ])('refuse %s', (_titre, raw, champ) => {
      expect(validateDto(CreateProductDto, raw).errors).toContain(champ);
    });

    it('refuse un champ inconnu, plutôt que de l’ignorer en silence', () => {
      expect(isValid(CreateProductDto, { ...minimal, companyId: 'pirate' })).toBe(false);
    });

    it('valide les attributs imbriqués', () => {
      expect(
        validateDto(CreateProductDto, {
          ...minimal,
          attributes: [{ value: 'Noir' }],
        }).errors,
      ).toContain('attributes.0.attributeDefinitionId');
    });

    it('accepte une valeur d’attribut de n’importe quelle forme', () => {
      // Le type réel n'est connu qu'en base : c'est le service qui tranche.
      expect(isValid(ValueAttributeDto, { attributeDefinitionId: 'a1', value: ['x', 'y'] })).toBe(
        true,
      );
    });
  });

  describe('UpdateProductDto', () => {
    it('accepte une modification partielle', () => {
      expect(isValid(UpdateProductDto, { name: 'Autre' })).toBe(true);
    });

    it('accepte un corps vide : ne rien changer est licite', () => {
      expect(isValid(UpdateProductDto, {})).toBe(true);
    });

    it('applique les mêmes bornes qu’à la création', () => {
      expect(isValid(UpdateProductDto, { quantity: 0 })).toBe(false);
    });
  });

  describe('ChangeStatusDto', () => {
    it('exige le statut cible', () => {
      expect(validateDto(ChangeStatusDto, {}).errors).toContain('statusId');
    });

    it('accepte prix et date de vente', () => {
      expect(
        isValid(ChangeStatusDto, { statusId: 's1', soldPrice: 12.5, soldAt: '2026-08-01' }),
      ).toBe(true);
    });

    it('refuse un prix vendu négatif', () => {
      expect(isValid(ChangeStatusDto, { statusId: 's1', soldPrice: -1 })).toBe(false);
    });
  });

  describe('UpdateSaleDto', () => {
    it('accepte une correction de commission entre 0 et 100', () => {
      expect(isValid(UpdateSaleDto, { appliedCommission: 40 })).toBe(true);
      expect(isValid(UpdateSaleDto, { appliedCommission: 101 })).toBe(false);
      expect(isValid(UpdateSaleDto, { appliedCommission: -1 })).toBe(false);
    });
  });

  describe('AssignShopDto', () => {
    it('accepte une boutique, ou aucune pour le stock central', () => {
      expect(isValid(AssignShopDto, { shopId: 'b1' })).toBe(true);
      expect(isValid(AssignShopDto, {})).toBe(true);
    });
  });

  describe('DepositorPaymentDto', () => {
    it('exige un booléen', () => {
      expect(isValid(DepositorPaymentDto, { paid: true })).toBe(true);
      expect(validateDto(DepositorPaymentDto, {}).errors).toContain('paid');
    });
  });

  describe('FilterProductsDto', () => {
    it('accepte une absence totale de filtre', () => {
      expect(isValid(FilterProductsDto, {})).toBe(true);
    });

    it('convertit les nombres arrivés en chaîne depuis l’URL', () => {
      const { instance } = validateDto(FilterProductsDto, { page: '2', perPage: '50' });
      expect(instance.page).toBe(2);
      expect(instance.perPage).toBe(50);
    });

    it('borne la pagination pour éviter un export déguisé', () => {
      expect(isValid(FilterProductsDto, { page: 0 })).toBe(false);
      expect(isValid(FilterProductsDto, { perPage: 1000 })).toBe(false);
    });

    it('refuse un type de vente inconnu', () => {
      expect(isValid(FilterProductsDto, { saleType: 'TROC' })).toBe(false);
    });
  });

  describe('CreateLotDto', () => {
    const lot = {
      totalPurchasePrice: 7,
      lines: [{ name: 'T-shirt', categoryId: 'c1', salePrice: 10, count: 4 }],
    };

    it('accepte un lot complet', () => {
      expect(isValid(CreateLotDto, lot)).toBe(true);
    });

    it('exige le prix payé et au moins une ligne', () => {
      const { errors } = validateDto(CreateLotDto, {});
      expect(errors).toEqual(expect.arrayContaining(['totalPurchasePrice', 'lines']));
    });

    it('refuse un lot sans ligne', () => {
      expect(validateDto(CreateLotDto, { totalPurchasePrice: 7, lines: [] }).errors).toContain(
        'lines',
      );
    });

    it('accepte un lot gratuit, mais pas un prix négatif', () => {
      expect(isValid(CreateLotDto, { ...lot, totalPurchasePrice: 0 })).toBe(true);
      expect(isValid(CreateLotDto, { ...lot, totalPurchasePrice: -1 })).toBe(false);
    });

    it('refuse un prix payé à trois décimales', () => {
      expect(isValid(CreateLotDto, { ...lot, totalPurchasePrice: 1.234 })).toBe(false);
    });

    it("refuse un prix d'achat par ligne — c'est le lot qui le porte", () => {
      expect(
        isValid(CreateLotDto, {
          totalPurchasePrice: 7,
          lines: [{ name: 'T-shirt', categoryId: 'c1', purchasePrice: 2 }],
        }),
      ).toBe(false);
    });

    it('refuse une quantité par ligne — chaque exemplaire est un produit', () => {
      expect(
        isValid(CreateLotDto, {
          totalPurchasePrice: 7,
          lines: [{ name: 'T-shirt', categoryId: 'c1', quantity: 4 }],
        }),
      ).toBe(false);
    });

    it('borne le nombre d’exemplaires par ligne', () => {
      expect(isValid(CreateLotDto, { ...lot, lines: [{ ...lot.lines[0], count: 0 }] })).toBe(false);
      expect(isValid(CreateLotDto, { ...lot, lines: [{ ...lot.lines[0], count: 101 }] })).toBe(
        false,
      );
    });

    it('valide chaque ligne comme un produit', () => {
      expect(
        validateDto(CreateLotDto, { totalPurchasePrice: 7, lines: [{ salePrice: 10 }] }).errors,
      ).toContain('lines.0.name');
    });
  });
});
