import { SetAttributesDto } from '../categories/dto/set-attributes.dto';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';
import { AttachProductsDto } from '../deposit-contracts/dto/attach-products.dto';
import { CreateContractDto } from '../deposit-contracts/dto/create-contract.dto';
import { UpdateContractDto } from '../deposit-contracts/dto/update-contract.dto';
import { CreateDepositorDto } from '../depositors/dto/create-depositor.dto';
import { UpdateDepositorDto } from '../depositors/dto/update-depositor.dto';
import { CreateShopDto } from '../shops/dto/create-shop.dto';
import { UpdateShopDto } from '../shops/dto/update-shop.dto';
import { UpdateStatusDto } from '../statuses/dto/update-status.dto';
import { InviteUserDto } from '../users/dto/invite-user.dto';
import { SetAccessDto } from '../users/dto/set-access.dto';
import { PeriodDto } from '../stats/dto/period.dto';
import { isValid, validateDto } from './validate';

describe('DTO catégories', () => {
  it('exige un nom à la création', () => {
    expect(validateDto(CreateCategoryDto, {}).errors).toContain('name');
  });

  it('accepte une racine, sans parent', () => {
    expect(isValid(CreateCategoryDto, { name: 'Sac' })).toBe(true);
  });

  it('accepte une modification partielle', () => {
    expect(isValid(UpdateCategoryDto, {})).toBe(true);
    expect(isValid(UpdateCategoryDto, { name: 'Sacs' })).toBe(true);
  });

  it('refuse un doublon dans la liste d’attributs', () => {
    expect(
      validateDto(SetAttributesDto, { attributeDefinitionIds: ['a1', 'a1'] }).errors,
    ).toContain('attributeDefinitionIds');
  });
});

describe('DTO contrats de dépôt', () => {
  const contrat = { depositorId: 'd1', startDate: '2026-01-01', endDate: '2026-06-01' };

  it('exige déposant et dates', () => {
    const { errors } = validateDto(CreateContractDto, {});
    expect(errors).toEqual(expect.arrayContaining(['depositorId', 'startDate', 'endDate']));
  });

  it('refuse une date qui n’est pas une date ISO', () => {
    expect(validateDto(CreateContractDto, { ...contrat, endDate: '01/06/2026' }).errors).toContain(
      'endDate',
    );
  });

  it('borne la commission entre 0 et 100', () => {
    expect(isValid(CreateContractDto, { ...contrat, commission: 0 })).toBe(true);
    expect(isValid(CreateContractDto, { ...contrat, commission: 100 })).toBe(true);
    expect(isValid(CreateContractDto, { ...contrat, commission: 101 })).toBe(false);
    expect(isValid(CreateContractDto, { ...contrat, commission: -1 })).toBe(false);
  });

  it('accepte une modification partielle et un changement de statut', () => {
    expect(isValid(UpdateContractDto, {})).toBe(true);
    expect(isValid(UpdateContractDto, { status: 'CLOSED' })).toBe(true);
    expect(isValid(UpdateContractDto, { status: 'TERMINE' })).toBe(false);
  });

  it('accepte des articles saisis avec le contrat', () => {
    expect(
      isValid(CreateContractDto, {
        ...contrat,
        products: [{ name: 'Robe', categoryId: 'c1', salePrice: 15 }],
      }),
    ).toBe(true);
  });

  it('valide chaque article comme un produit', () => {
    expect(
      validateDto(CreateContractDto, { ...contrat, products: [{ salePrice: 15 }] }).errors,
    ).toContain('products.0.name');
  });

  it("refuse un prix d'achat sur un article déposé — il appartient au déposant", () => {
    expect(
      isValid(CreateContractDto, {
        ...contrat,
        products: [{ name: 'Robe', categoryId: 'c1', purchasePrice: 10 }],
      }),
    ).toBe(false);
  });

  it('refuse un dépôt de plus de 200 articles en une fois', () => {
    const trop = Array.from({ length: 201 }, () => ({ name: 'x', categoryId: 'c1' }));
    expect(validateDto(CreateContractDto, { ...contrat, products: trop }).errors).toContain(
      'products',
    );
  });

  it('refuse un doublon dans les produits à rattacher', () => {
    expect(validateDto(AttachProductsDto, { productIds: ['p1', 'p1'] }).errors).toContain(
      'productIds',
    );
    expect(isValid(AttachProductsDto, { productIds: ['p1', 'p2'] })).toBe(true);
  });
});

describe('DTO déposants', () => {
  it('exige un nom', () => {
    expect(validateDto(CreateDepositorDto, {}).errors).toContain('lastName');
  });

  it('normalise l’email quand il est fourni', () => {
    const { instance, errors } = validateDto(CreateDepositorDto, {
      lastName: 'Martin',
      email: ' Sophie@Test.FR ',
    });
    expect(errors).toEqual([]);
    expect(instance.email).toBe('sophie@test.fr');
  });

  it('accepte un déposant sans email : le contact peut être un téléphone', () => {
    expect(isValid(CreateDepositorDto, { lastName: 'Martin' })).toBe(true);
  });

  it('borne la commission par défaut entre 0 et 100', () => {
    expect(isValid(CreateDepositorDto, { lastName: 'M', defaultCommission: 101 })).toBe(false);
  });

  it('accepte une modification partielle', () => {
    expect(isValid(UpdateDepositorDto, {})).toBe(true);
  });
});

describe('DTO boutiques', () => {
  it('exige un nom', () => {
    expect(validateDto(CreateShopDto, {}).errors).toContain('name');
  });

  it('rend l’adresse facultative', () => {
    expect(isValid(CreateShopDto, { name: 'Centre-ville' })).toBe(true);
  });

  it('accepte une modification partielle', () => {
    expect(isValid(UpdateShopDto, {})).toBe(true);
  });
});

describe('DTO statuts', () => {
  it('accepte un renommage seul', () => {
    expect(isValid(UpdateStatusDto, { name: 'Au dépôt' })).toBe(true);
  });

  it('refuse une couleur qui n’est pas hexadécimale', () => {
    expect(isValid(UpdateStatusDto, { color: 'rouge' })).toBe(false);
    expect(isValid(UpdateStatusDto, { color: '#a1b2c3' })).toBe(true);
  });
});

describe('DTO utilisateurs', () => {
  const invitation = { email: 'a@b.fr', firstName: 'Léa', lastName: 'Bernard' };

  it('rend le mot de passe facultatif : il est généré sinon', () => {
    expect(isValid(InviteUserDto, invitation)).toBe(true);
  });

  it('impose huit caractères au mot de passe fourni', () => {
    expect(isValid(InviteUserDto, { ...invitation, password: 'court' })).toBe(false);
  });

  it('refuse une permission inconnue', () => {
    expect(
      validateDto(SetAccessDto, {
        accesses: [{ shopId: 'b1', permissions: ['produits.voir'] }],
      }).errors.length,
    ).toBeGreaterThan(0);
  });

  it('accepte une permission connue', () => {
    expect(
      isValid(SetAccessDto, { accesses: [{ shopId: 'b1', permissions: ['products.view'] }] }),
    ).toBe(true);
  });

  it('accepte une liste d’accès vide', () => {
    expect(isValid(SetAccessDto, { accesses: [] })).toBe(true);
  });
});

describe('DTO période', () => {
  it('accepte une absence de bornes', () => {
    expect(isValid(PeriodDto, {})).toBe(true);
  });

  it('refuse une borne qui n’est pas une date ISO', () => {
    expect(validateDto(PeriodDto, { from: 'hier' }).errors).toContain('from');
  });
});
