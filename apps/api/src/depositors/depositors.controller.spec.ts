import { DepositorsController } from './depositors.controller';
import type { DepositorsService } from './depositors.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('DepositorsController', () => {
  const service = {
    list: jest.fn(),
    detail: jest.fn(),
    products: jest.fn(),
    statement: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as DepositorsService;
  const controller = new DepositorsController(service);

  it('est monté sur /depositors', () => {
    expect(prefix(DepositorsController)).toBe('depositors');
  });

  it.each([
    ['list', 'GET', '/'],
    ['detail', 'GET', ':id'],
    ['products', 'GET', ':id/products'],
    ['statement', 'GET', ':id/statement'],
    ['create', 'POST', '/'],
    ['update', 'PUT', ':id'],
    ['delete', 'DELETE', ':id'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(DepositorsController, name)).toMatchObject({ method, path });
  });

  it.each([
    ['list', 'depositors.manage'],
    ['detail', 'depositors.manage'],
    ['products', 'depositors.manage'],
    ['statement', 'depositors.manage'],
    ['create', 'depositors.manage'],
    ['update', 'depositors.manage'],
    ['delete', 'depositors.manage'],
  ])('%s exige la permission %s', (name, permission) => {
    expect(route(DepositorsController, name).permissions).toEqual([permission].flat());
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('detail appelle detail', () => {
      void controller.detail(manager, 'd1');
      expect(service.detail).toHaveBeenCalledWith(manager, 'd1');
    });

    it('products appelle products', () => {
      void controller.products(manager, 'd1');
      expect(service.products).toHaveBeenCalledWith(manager, 'd1');
    });

    it('statement appelle statement', () => {
      void controller.statement(manager, 'd1');
      expect(service.statement).toHaveBeenCalledWith(manager, 'd1');
    });

    it('create appelle create', () => {
      void controller.create(manager, { lastName: 'Martin' });
      expect(service.create).toHaveBeenCalledWith(manager, { lastName: 'Martin' });
    });

    it('update appelle update', () => {
      void controller.update(manager, 'd1', { lastName: 'x' });
      expect(service.update).toHaveBeenCalledWith(manager, 'd1', { lastName: 'x' });
    });

    it('delete appelle delete', () => {
      void controller.delete(manager, 'd1');
      expect(service.delete).toHaveBeenCalledWith(manager, 'd1');
    });
  });
});
