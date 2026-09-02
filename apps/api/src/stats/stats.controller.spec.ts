import { StatsController } from './stats.controller';
import type { StatsService } from './stats.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('StatsController', () => {
  const service = {
    dashboard: jest.fn(),
    layout: jest.fn(),
    saveLayout: jest.fn(),
  } as unknown as StatsService;
  const controller = new StatsController(service);

  it('est monté sur /stats', () => {
    expect(prefix(StatsController)).toBe('stats');
  });

  it.each([
    ['dashboard', 'GET', 'dashboard'],
    ['layout', 'GET', 'layout'],
    ['saveLayout', 'PUT', 'layout'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(StatsController, name)).toMatchObject({ method, path });
  });

  it("n'exige aucune permission de route : le découpage est dans le service", () => {
    // Trois droits ouvrent des blocs différents du tableau de bord. Un garde de
    // route ne saurait en exiger qu'un — et le remettre ici refermerait la page
    // à l'employé qui n'a que `stock.view`.
    expect(route(StatsController, 'dashboard').permissions).toBeUndefined();
  });

  it('n’exige aucune permission pour ranger ses propres modules', () => {
    // C'est une préférence d'affichage, pas une donnée de la boutique : ranger
    // une carte n'ouvre pas le bloc qu'elle contient.
    expect(route(StatsController, 'layout').permissions).toBeUndefined();
    expect(route(StatsController, 'saveLayout').permissions).toBeUndefined();
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('dashboard appelle dashboard', () => {
      void controller.dashboard(manager, {});
      expect(service.dashboard).toHaveBeenCalledWith(manager, {});
    });

    it('layout appelle layout', () => {
      void controller.layout(manager);
      expect(service.layout).toHaveBeenCalledWith(manager);
    });

    it('saveLayout appelle saveLayout', () => {
      const dto = { modules: [{ key: 'rotation', visible: true }] };
      void controller.saveLayout(manager, dto);
      expect(service.saveLayout).toHaveBeenCalledWith(manager, dto);
    });
  });
});
