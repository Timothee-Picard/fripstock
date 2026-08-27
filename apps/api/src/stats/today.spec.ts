import { dayBounds } from './today';

/** Instant lisible, pour comparer sans dépendre du fuseau de la machine. */
const iso = (d: Date) => d.toISOString();

describe('dayBounds', () => {
  it('cale la journée sur minuit à Paris, et non sur minuit UTC', () => {
    // 27 août, heure d'été : Paris est à UTC+2.
    const { from, to } = dayBounds(new Date('2026-08-27T12:00:00Z'), 'Europe/Paris');
    expect(iso(from)).toBe('2026-08-26T22:00:00.000Z');
    expect(iso(to)).toBe('2026-08-27T21:59:59.999Z');
  });

  it('suit le changement d’heure : en hiver, Paris est à UTC+1', () => {
    const { from } = dayBounds(new Date('2026-01-15T12:00:00Z'), 'Europe/Paris');
    expect(iso(from)).toBe('2026-01-14T23:00:00.000Z');
  });

  it('range une vente de 00 h 30 à Paris dans le bon jour', () => {
    // 00 h 30 le 27 à Paris, soit 22 h 30 le 26 en UTC : c'est bien le 27.
    const vente = new Date('2026-08-26T22:30:00Z');
    const { from, to } = dayBounds(vente, 'Europe/Paris');
    expect(vente >= from && vente <= to).toBe(true);
    expect(iso(from).startsWith('2026-08-26T22')).toBe(true);
  });

  it('couvre exactement vingt-quatre heures', () => {
    const { from, to } = dayBounds(new Date('2026-08-27T12:00:00Z'), 'Europe/Paris');
    expect(to.getTime() - from.getTime()).toBe(86400000 - 1);
  });

  it('vaut aussi pour un fuseau en avance', () => {
    const { from } = dayBounds(new Date('2026-08-27T12:00:00Z'), 'Asia/Tokyo');
    expect(iso(from)).toBe('2026-08-26T15:00:00.000Z');
  });

  it('retombe sur minuit UTC pour un fuseau sans décalage', () => {
    const { from } = dayBounds(new Date('2026-08-27T12:00:00Z'), 'UTC');
    expect(iso(from)).toBe('2026-08-27T00:00:00.000Z');
  });

  it('prend l’instant présent par défaut', () => {
    const { from, to } = dayBounds();
    const maintenant = Date.now();
    expect(from.getTime()).toBeLessThanOrEqual(maintenant);
    expect(to.getTime()).toBeGreaterThanOrEqual(maintenant);
  });
});
