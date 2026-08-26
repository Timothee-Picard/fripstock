import { UsersController } from './users.controller';
import type { UsersService } from './users.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('UsersController', () => {
  const service = {
    list: jest.fn(),
    invite: jest.fn(),
    setAccess: jest.fn(),
    delete: jest.fn(),
  } as unknown as UsersService;
  const controller = new UsersController(service);

  it('est monté sur /users', () => {
    expect(prefix(UsersController)).toBe('users');
  });

  it.each([
    ['list', 'GET', '/'],
    ['invite', 'POST', 'invite'],
    ['setAccess', 'PUT', ':id/access'],
    ['delete', 'DELETE', ':id'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(UsersController, name)).toMatchObject({ method, path });
  });

  it('tout le contrôleur est réservé au gérant', () => {
    expect(Reflect.getMetadata('managerOnly', UsersController)).toBe(true);
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('invite appelle invite', () => {
      void controller.invite(manager, { email: 'a@b.fr', firstName: 'A', lastName: 'B' });
      expect(service.invite).toHaveBeenCalledWith(manager, {
        email: 'a@b.fr',
        firstName: 'A',
        lastName: 'B',
      });
    });

    it('setAccess appelle setAccess', () => {
      void controller.setAccess(manager, 'u2', { accesses: [] });
      expect(service.setAccess).toHaveBeenCalledWith(manager, 'u2', { accesses: [] });
    });

    it('delete appelle delete', () => {
      void controller.delete(manager, 'u2');
      expect(service.delete).toHaveBeenCalledWith(manager, 'u2');
    });
  });
});
