import { describe, expect, it } from 'vitest';
import { formatCalendarDay, formatDate, formatDateTime, formatShortDate } from './dates';

/**
 * Ces attentes sont écrites en heure de Paris alors que le conteneur de test
 * tourne en UTC : c'est exactement ce qu'on veut vérifier. Le rendu ne doit
 * dépendre que du fuseau de la boutique, jamais de l'horloge de la machine —
 * sinon le serveur et le navigateur écrivent deux heures différentes et React
 * refuse l'hydratation.
 */
describe('formatage des dates', () => {
  it("rend l'heure de la boutique, pas celle du processus", () => {
    // Le cas exact du rapport d'erreur : 14:55 UTC est 16:55 à Paris.
    expect(formatDateTime('2026-08-27T14:55:00Z')).toBe('27/08/2026 16:55');
  });

  it("suit le changement d'heure plutôt qu'un décalage figé", () => {
    // Août : UTC+2. Janvier : UTC+1.
    expect(formatDateTime('2026-01-15T14:55:00Z')).toBe('15/01/2026 15:55');
  });

  it('rattache un soir tardif à la journée que la boutique a vécue', () => {
    // 21 h 30 UTC, soit 23 h 30 à Paris : c'est encore le 27, pas le 28.
    expect(formatDate('2026-08-27T21:30:00Z')).toBe('27/08/2026');
    // 23 h 30 UTC, soit 1 h 30 le lendemain à Paris.
    expect(formatDate('2026-08-27T23:30:00Z')).toBe('28/08/2026');
  });

  it('abrège pour un axe de graphique', () => {
    expect(formatShortDate('2026-08-27T14:55:00Z')).toBe('27/08');
  });

  it('accepte un objet Date comme une chaîne ISO', () => {
    expect(formatDate(new Date('2026-08-27T14:55:00Z'))).toBe('27/08/2026');
  });

  describe('jour calendaire', () => {
    it("ne glisse pas d'un jour, dans un sens ou dans l'autre", () => {
      expect(formatCalendarDay('2026-08-27')).toBe('27/08/2026');
      expect(formatCalendarDay('2026-01-01')).toBe('01/01/2026');
      expect(formatCalendarDay('2026-12-31')).toBe('31/12/2026');
    });

    it('accepte une mise en forme longue, pour la bannière du jour', () => {
      expect(
        formatCalendarDay('2026-08-27', { weekday: 'long', day: 'numeric', month: 'long' }),
      ).toBe('jeudi 27 août');
    });
  });
});
