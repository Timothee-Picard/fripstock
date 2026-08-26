import { AttributesController } from './attributes.controller';
import type { AttributesService } from './attributes.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('AttributesController', () => {
  const service = {
    listTemplates: jest.fn(),
    list: jest.fn(),
    detail: jest.fn(),
    create: jest.fn(),
    cloneFromTemplate: jest.fn(),
    update: jest.fn(),
    setOptions: jest.fn(),
    setCategories: jest.fn(),
    delete: jest.fn(),
  } as unknown as AttributesService;
  const controller = new AttributesController(service);

  it('est monté sur /attributes', () => {
    expect(prefix(AttributesController)).toBe('attributes');
  });

  it.each([
    ['templates', 'GET', 'templates'],
    ['list', 'GET', '/'],
    ['detail', 'GET', ':id'],
    ['create', 'POST', '/'],
    ['clone', 'POST', 'from-template/:templateId'],
    ['update', 'PUT', ':id'],
    ['setOptions', 'PUT', ':id/options'],
    ['setCategories', 'PUT', ':id/categories'],
    ['delete', 'DELETE', ':id'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(AttributesController, name)).toMatchObject({ method, path });
  });

  it.each([
    ['create', 'attributes.manage'],
    ['clone', 'attributes.manage'],
    ['update', 'attributes.manage'],
    ['setOptions', 'attributes.manage'],
    ['setCategories', 'attributes.manage'],
    ['delete', 'attributes.manage'],
  ])('%s exige la permission %s', (name, permission) => {
    expect(route(AttributesController, name).permission).toBe(permission);
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('templates appelle listTemplates', () => {
      void controller.templates();
      expect(service.listTemplates).toHaveBeenCalledWith();
    });

    it('list appelle list', () => {
      void controller.list(manager);
      expect(service.list).toHaveBeenCalledWith(manager);
    });

    it('detail appelle detail', () => {
      void controller.detail(manager, 'a1');
      expect(service.detail).toHaveBeenCalledWith(manager, 'a1');
    });

    it('create appelle create', () => {
      void controller.create(manager, { name: 'Couleur', type: 'TEXT' as const });
      expect(service.create).toHaveBeenCalledWith(manager, { name: 'Couleur', type: 'TEXT' });
    });

    it('clone appelle cloneFromTemplate', () => {
      void controller.clone(manager, 't1');
      expect(service.cloneFromTemplate).toHaveBeenCalledWith(manager, 't1');
    });

    it('update appelle update', () => {
      void controller.update(manager, 'a1', { name: 'x' });
      expect(service.update).toHaveBeenCalledWith(manager, 'a1', { name: 'x' });
    });

    it('setOptions appelle setOptions', () => {
      void controller.setOptions(manager, 'a1', { options: [] });
      expect(service.setOptions).toHaveBeenCalledWith(manager, 'a1', { options: [] });
    });

    it('setCategories appelle setCategories', () => {
      void controller.setCategories(manager, 'a1', { categoryIds: [] });
      expect(service.setCategories).toHaveBeenCalledWith(manager, 'a1', { categoryIds: [] });
    });

    it('delete appelle delete', () => {
      void controller.delete(manager, 'a1');
      expect(service.delete).toHaveBeenCalledWith(manager, 'a1');
    });
  });
});
