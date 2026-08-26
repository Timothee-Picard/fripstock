import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('NotificationsController', () => {
  const service = {
    list: jest.fn(),
    markAllRead: jest.fn(),
    markRead: jest.fn(),
  } as unknown as NotificationsService;
  const controller = new NotificationsController(service);

  it('est monté sur /notifications', () => {
    expect(prefix(NotificationsController)).toBe('notifications');
  });

  it.each([
    ['list', 'GET', '/'],
    ['markAllRead', 'PUT', 'read-all'],
    ['markRead', 'PUT', ':id/read'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(NotificationsController, name)).toMatchObject({ method, path });
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('markAllRead appelle markAllRead', () => {
      void controller.markAllRead(manager);
      expect(service.markAllRead).toHaveBeenCalledWith(manager);
    });

    it('markRead appelle markRead', () => {
      void controller.markRead(manager, 'n1');
      expect(service.markRead).toHaveBeenCalledWith(manager, 'n1');
    });
  });
});
