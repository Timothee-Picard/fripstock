import { CategoriesController } from './categories.controller';
import type { CategoriesService } from './categories.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('CategoriesController', () => {
  const service = {
    list: jest.fn(),
    tree: jest.fn(),
    detail: jest.fn(),
    attributesOf: jest.fn(),
    setAttributes: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as CategoriesService;
  const controller = new CategoriesController(service);

  it('est monté sur /categories', () => {
    expect(prefix(CategoriesController)).toBe('categories');
  });

  it.each([
    ['list', 'GET', '/'],
    ['tree', 'GET', 'tree'],
    ['detail', 'GET', ':id'],
    ['attributes', 'GET', ':id/attributes'],
    ['setAttributes', 'PUT', ':id/attributes'],
    ['create', 'POST', '/'],
    ['update', 'PUT', ':id'],
    ['delete', 'DELETE', ':id'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(CategoriesController, name)).toMatchObject({ method, path });
  });

  it.each([
    ['setAttributes', 'attributes.manage'],
    ['create', 'categories.manage'],
    ['update', 'categories.manage'],
    ['delete', 'categories.manage'],
  ])('%s exige la permission %s', (name, permission) => {
    expect(route(CategoriesController, name).permission).toBe(permission);
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('tree appelle tree', () => {
      void controller.tree(manager);
      expect(service.tree).toHaveBeenCalledWith(manager);
    });

    it('detail appelle detail', () => {
      void controller.detail(manager, 'c1');
      expect(service.detail).toHaveBeenCalledWith(manager, 'c1');
    });

    it('attributes appelle attributesOf', () => {
      void controller.attributes(manager, 'c1');
      expect(service.attributesOf).toHaveBeenCalledWith(manager, 'c1');
    });

    it('setAttributes appelle setAttributes', () => {
      void controller.setAttributes(manager, 'c1', { attributeDefinitionIds: [] });
      expect(service.setAttributes).toHaveBeenCalledWith(manager, 'c1', {
        attributeDefinitionIds: [],
      });
    });

    it('create appelle create', () => {
      void controller.create(manager, { name: 'Sac' });
      expect(service.create).toHaveBeenCalledWith(manager, { name: 'Sac' });
    });

    it('update appelle update', () => {
      void controller.update(manager, 'c1', { name: 'Sac' });
      expect(service.update).toHaveBeenCalledWith(manager, 'c1', { name: 'Sac' });
    });

    it('delete appelle delete', () => {
      void controller.delete(manager, 'c1');
      expect(service.delete).toHaveBeenCalledWith(manager, 'c1');
    });
  });
});
