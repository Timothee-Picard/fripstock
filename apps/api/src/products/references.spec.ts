import { consignmentReference, depositorCode, freeCode, resaleReference } from './references';

describe('depositorCode', () => {
  it('retient les trois premières lettres du nom', () => {
    expect(depositorCode('Martin')).toBe('MAR');
  });

  it('déplie les accents, pour que la référence reste dictable', () => {
    expect(depositorCode('Écrivain')).toBe('ECR');
    expect(depositorCode('Nguyên-Bá')).toBe('NGU');
  });

  it('écarte espaces, tirets et apostrophes', () => {
    expect(depositorCode("O'Brien")).toBe('OBR');
    expect(depositorCode('de la Tour')).toBe('DEL');
  });

  it('complète un nom trop court avec le prénom', () => {
    expect(depositorCode('Li', 'Anna')).toBe('LIA');
  });

  it('complète avec des X quand il n’y a vraiment pas de quoi', () => {
    expect(depositorCode('Li')).toBe('LIX');
    expect(depositorCode('O')).toBe('OXX');
  });

  it('retombe sur un code neutre pour un nom sans lettre', () => {
    expect(depositorCode('---')).toBe('DEP');
    expect(depositorCode('')).toBe('DEP');
  });

  it('rend toujours trois caractères', () => {
    for (const nom of ['Martin', 'Li', 'O', '', 'Nguyên-Bá', 'X']) {
      expect(depositorCode(nom)).toHaveLength(3);
    }
  });
});

describe('freeCode', () => {
  it('garde le code souhaité quand il est libre', () => {
    expect(freeCode('MAR', new Set())).toBe('MAR');
  });

  it('suffixe le second homonyme', () => {
    expect(freeCode('MAR', new Set(['MAR']))).toBe('MA2');
  });

  it('continue tant que les codes sont pris', () => {
    expect(freeCode('MAR', new Set(['MAR', 'MA2', 'MA3']))).toBe('MA4');
  });

  it('garde la même longueur, pour que les références s’alignent', () => {
    expect(freeCode('MAR', new Set(['MAR']))).toHaveLength(3);
    const pris = new Set(['MAR', ...Array.from({ length: 8 }, (_, i) => `MA${i + 2}`)]);
    expect(freeCode('MAR', pris)).toHaveLength(3);
  });

  it('passe à deux chiffres au-delà de neuf homonymes', () => {
    const pris = new Set(['MAR', ...Array.from({ length: 8 }, (_, i) => `MA${i + 2}`)]);
    expect(freeCode('MAR', pris)).toBe('M10');
  });

  it('finit par rendre le code souhaité plutôt que de boucler', () => {
    const pris = new Set<string>(['MAR']);
    for (let n = 2; n < 1000; n += 1) {
      const s = String(n);
      pris.add('MAR'.slice(0, Math.max(1, 3 - s.length)) + s);
    }
    expect(freeCode('MAR', pris)).toBe('MAR');
  });
});

describe('resaleReference', () => {
  it('complète sur quatre chiffres', () => {
    expect(resaleReference(42)).toBe('A-0042');
    expect(resaleReference(1)).toBe('A-0001');
  });

  it('laisse grandir au-delà de quatre chiffres', () => {
    expect(resaleReference(12345)).toBe('A-12345');
  });
});

describe('consignmentReference', () => {
  it('assemble code du déposant et numéro sur trois chiffres', () => {
    expect(consignmentReference('MAR', 1)).toBe('D-MAR-001');
    expect(consignmentReference('DUR', 12)).toBe('D-DUR-012');
  });

  it('laisse grandir au-delà de trois chiffres', () => {
    expect(consignmentReference('MAR', 1234)).toBe('D-MAR-1234');
  });
});
