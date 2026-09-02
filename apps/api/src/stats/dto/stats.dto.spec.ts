import { DashboardLayoutDto } from './dashboard-layout.dto';
import { PeriodDto } from './period.dto';
import { isValid, validateDto } from '../../test/validate';

describe('DTO statistiques', () => {
  describe('PeriodDto', () => {
    it('accepte une période et un endroit', () => {
      expect(isValid(PeriodDto, { from: '2026-01-01', shopId: 'b1' })).toBe(true);
      expect(isValid(PeriodDto, { channel: 'online' })).toBe(true);
    });

    it.each([
      ['une date qui n’en est pas une', { from: 'hier' }, 'from'],
      ['un canal inconnu', { channel: 'vinted' }, 'channel'],
    ])('refuse %s', (_cas, raw, champ) => {
      expect(validateDto(PeriodDto, raw).errors).toContain(champ);
    });
  });

  describe('DashboardLayoutDto', () => {
    it('accepte un rangement, module par attribut compris', () => {
      expect(
        isValid(DashboardLayoutDto, {
          modules: [
            { key: 'sales-curve', visible: true },
            { key: 'attribute:clx123', visible: false },
          ],
        }),
      ).toBe(true);
    });

    it('accepte un rangement vide : tout est masqué, c’est un choix', () => {
      expect(isValid(DashboardLayoutDto, { modules: [] })).toBe(true);
    });

    it.each([
      ['une clé qui n’a pas la forme attendue', [{ key: 'Ventes !', visible: true }]],
      ['une clé vide', [{ key: '', visible: true }]],
      ['une visibilité absente', [{ key: 'rotation' }]],
      [
        'deux fois le même module',
        [
          { key: 'rotation', visible: true },
          { key: 'rotation', visible: false },
        ],
      ],
    ])('refuse %s', (_cas, modules) => {
      expect(isValid(DashboardLayoutDto, { modules })).toBe(false);
    });

    it('refuse une liste plus longue que le catalogue plausible', () => {
      const modules = Array.from({ length: 61 }, (_, i) => ({ key: `m-${i}`, visible: true }));
      expect(validateDto(DashboardLayoutDto, { modules }).errors).toContain('modules');
    });
  });
});
