import { normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('met en minuscules et retire les espaces autour', () => {
    expect(normalizeEmail('  Alice@Test.FR ')).toBe('alice@test.fr');
  });

  it('laisse intact un email déjà normalisé', () => {
    expect(normalizeEmail('alice@test.fr')).toBe('alice@test.fr');
  });

  it('ne touche pas aux espaces internes, qui restent une erreur de saisie', () => {
    expect(normalizeEmail(' a b@test.fr ')).toBe('a b@test.fr');
  });
});
