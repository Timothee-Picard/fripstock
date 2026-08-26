import { StatsController } from './stats.controller';
import type { StatsService } from './stats.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('StatsController', () => {
  const service = {
    dashboard: jest.fn(),
  } as unknown as StatsService;
  const controller = new StatsController(service);

  it('est monté sur /stats', () => {
    expect(prefix(StatsController)).toBe('stats');
  });

  it.each([['dashboard', 'GET', 'dashboard']])('%s → %s %s', (name, method, path) => {
    expect(route(StatsController, name)).toMatchObject({ method, path });
  });

  it.each([['dashboard', 'stats.view']])('%s exige la permission %s', (name, permission) => {
    expect(route(StatsController, name).permission).toBe(permission);
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('dashboard appelle dashboard', () => {
      void controller.dashboard(manager, {});
      expect(service.dashboard).toHaveBeenCalledWith(manager, {});
    });
  });
});
