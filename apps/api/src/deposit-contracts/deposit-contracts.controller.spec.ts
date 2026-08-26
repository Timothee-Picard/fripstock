import { DepositContractsController } from './deposit-contracts.controller';
import type { DepositContractsService } from './deposit-contracts.service';
import type { DeadlinesJob } from './deadlines.job';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('DepositContractsController', () => {
  const service = {
    list: jest.fn(),
    detail: jest.fn(),
    create: jest.fn(),
    attachProducts: jest.fn(),
    detachProduct: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as DepositContractsService;
  const job = { run: jest.fn().mockResolvedValue({ notified: 1, expired: 0 }) };
  const controller = new DepositContractsController(service, job as unknown as DeadlinesJob);

  it('est monté sur /deposit-contracts', () => {
    expect(prefix(DepositContractsController)).toBe('deposit-contracts');
  });

  it.each([
    ['list', 'GET', '/'],
    ['detail', 'GET', ':id'],
    ['create', 'POST', '/'],
    ['deadlines', 'POST', 'deadlines'],
    ['attach', 'POST', ':id/products'],
    ['detach', 'DELETE', ':id/products/:productId'],
    ['update', 'PUT', ':id'],
    ['delete', 'DELETE', ':id'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(DepositContractsController, name)).toMatchObject({ method, path });
  });

  it.each(['deadlines'])('%s est réservé au gérant', (name) => {
    expect(route(DepositContractsController, name).managerOnly).toBe(true);
  });

  it.each([
    ['list', 'deposits.manage'],
    ['detail', 'deposits.manage'],
    ['create', 'deposits.manage'],
    ['attach', 'deposits.manage'],
    ['detach', 'deposits.manage'],
    ['update', 'deposits.manage'],
    ['delete', 'deposits.manage'],
  ])('%s exige la permission %s', (name, permission) => {
    expect(route(DepositContractsController, name).permission).toBe(permission);
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('detail appelle detail', () => {
      void controller.detail(manager, 'c1');
      expect(service.detail).toHaveBeenCalledWith(manager, 'c1');
    });

    it('create appelle create', () => {
      void controller.create(manager, {
        depositorId: 'd1',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
      });
      expect(service.create).toHaveBeenCalledWith(manager, {
        depositorId: 'd1',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
      });
    });

    it('attach appelle attachProducts', () => {
      void controller.attach(manager, 'c1', { productIds: ['p1'] });
      expect(service.attachProducts).toHaveBeenCalledWith(manager, 'c1', { productIds: ['p1'] });
    });

    it('detach appelle detachProduct', () => {
      void controller.detach(manager, 'c1', 'p1');
      expect(service.detachProduct).toHaveBeenCalledWith(manager, 'c1', 'p1');
    });

    it('update appelle update', () => {
      void controller.update(manager, 'c1', { commission: 10 });
      expect(service.update).toHaveBeenCalledWith(manager, 'c1', { commission: 10 });
    });

    it('deadlines déclenche la passe d’échéances à la main', async () => {
      await expect(controller.deadlines()).resolves.toEqual({ notified: 1, expired: 0 });
      expect(job.run).toHaveBeenCalled();
    });

    it('delete appelle delete', () => {
      void controller.delete(manager, 'c1');
      expect(service.delete).toHaveBeenCalledWith(manager, 'c1');
    });
  });
});
