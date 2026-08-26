import { StatusesController } from './statuses.controller';
import type { StatusesService } from './statuses.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('StatusesController', () => {
  const service = {
    list: jest.fn(),
    update: jest.fn(),
    setDefault: jest.fn(),
    checkTransition: jest.fn(),
    defaults: jest.fn(),
  } as unknown as StatusesService;
  const controller = new StatusesController(service);

  it('est monté sur /statuses', () => {
    expect(prefix(StatusesController)).toBe('statuses');
  });

  it.each([
    ['list', 'GET', '/'],
    ['update', 'PUT', ':id'],
    ['setDefault', 'PUT', ':id/default'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(StatusesController, name)).toMatchObject({ method, path });
  });

  it.each(['update', 'setDefault'])('%s est réservé au gérant', (name) => {
    expect(route(StatusesController, name).managerOnly).toBe(true);
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('update appelle update', () => {
      void controller.update(manager, 's1', { name: 'x' });
      expect(service.update).toHaveBeenCalledWith(manager, 's1', { name: 'x' });
    });

    it('setDefault appelle setDefault', () => {
      void controller.setDefault(manager, 's1');
      expect(service.setDefault).toHaveBeenCalledWith(manager, 's1');
    });
  });
});
