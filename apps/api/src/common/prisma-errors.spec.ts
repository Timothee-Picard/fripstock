import { isUniqueViolation } from './prisma-errors';

/** L'erreur telle que Prisma 7 la produit avec l'adaptateur de driver. */
function doublon(index: string) {
  return Object.assign(new Error('Invalid `tx.product.create()` invocation'), {
    code: 'P2002',
    meta: {
      modelName: 'Product',
      cause: {
        originalCode: '23505',
        kind: 'UniqueConstraintViolation',
        constraint: { index },
        table: 'product',
      },
    },
  });
}

describe('isUniqueViolation', () => {
  it('reconnaît le doublon sur la contrainte visée', () => {
    expect(isUniqueViolation(doublon('product_company_id_reference_key'), 'reference')).toBe(true);
  });

  it('reconnaît aussi l’ancienne forme, avec meta.target', () => {
    const ancienne = Object.assign(new Error('x'), {
      code: 'P2002',
      meta: { target: ['company_id', 'reference'] },
    });
    expect(isUniqueViolation(ancienne, 'reference')).toBe(true);
  });

  it('ne confond pas deux contraintes différentes', () => {
    expect(isUniqueViolation(doublon('depositor_company_id_code_key'), 'reference')).toBe(false);
    expect(isUniqueViolation(doublon('depositor_company_id_code_key'), 'code')).toBe(true);
  });

  it('ignore les erreurs qui ne sont pas des doublons', () => {
    expect(isUniqueViolation(new Error('connexion perdue'), 'reference')).toBe(false);
    expect(isUniqueViolation({ code: 'P2025' }, 'reference')).toBe(false);
  });

  it('supporte une erreur sans métadonnées', () => {
    expect(isUniqueViolation({ code: 'P2002' }, 'reference')).toBe(false);
    expect(isUniqueViolation(null, 'reference')).toBe(false);
    expect(isUniqueViolation(undefined, 'reference')).toBe(false);
  });

  it('reste prudent face à des métadonnées circulaires', () => {
    const meta: Record<string, unknown> = {};
    meta.self = meta;
    expect(isUniqueViolation({ code: 'P2002', meta }, 'reference')).toBe(false);
  });
});
