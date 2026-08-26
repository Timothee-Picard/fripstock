import { ShopsController } from './shops.controller';
import type { ShopsService } from './shops.service';
import { prefix, route } from '../test/routes';
import { SHOP_ID, manager } from '../test/fixtures';

describe('ShopsController', () => {
  const shops = {
    list: jest.fn().mockResolvedValue([]),
    detail: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({ deleted: true }),
  };
  const controller = new ShopsController(shops as unknown as ShopsService);

  beforeEach(() => jest.clearAllMocks());

  it('est monté sur /shops', () => {
    expect(prefix(ShopsController)).toBe('shops');
  });

  describe('routes et droits', () => {
    it('la lecture est ouverte à tout utilisateur connecté', () => {
      expect(route(ShopsController, 'list')).toMatchObject({
        method: 'GET',
        path: '/',
        managerOnly: false,
        public: false,
      });
      expect(route(ShopsController, 'detail')).toMatchObject({ method: 'GET', path: ':id' });
    });

    it.each(['create', 'update', 'delete'])('%s est réservé au gérant', (name) => {
      expect(route(ShopsController, name).managerOnly).toBe(true);
    });
  });

  describe('délégation', () => {
    it('list passe l’utilisateur courant', async () => {
      await controller.list(manager);
      expect(shops.list).toHaveBeenCalledWith(manager);
    });

    it('detail passe l’identifiant', async () => {
      await controller.detail(manager, SHOP_ID);
      expect(shops.detail).toHaveBeenCalledWith(manager, SHOP_ID);
    });

    it('create passe le corps validé', async () => {
      await controller.create(manager, { name: 'Neuve' });
      expect(shops.create).toHaveBeenCalledWith(manager, { name: 'Neuve' });
    });

    it('update passe identifiant et corps', async () => {
      await controller.update(manager, SHOP_ID, { name: 'x' });
      expect(shops.update).toHaveBeenCalledWith(manager, SHOP_ID, { name: 'x' });
    });

    it('delete passe l’identifiant', async () => {
      await controller.delete(manager, SHOP_ID);
      expect(shops.delete).toHaveBeenCalledWith(manager, SHOP_ID);
    });
  });
});
