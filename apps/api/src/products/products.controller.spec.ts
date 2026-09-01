import { ProductsController } from './products.controller';
import type { ProductsService } from './products.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('ProductsController', () => {
  const service = {
    list: jest.fn(),
    createLot: jest.fn(),
    sellMany: jest.fn(),
    exportCsv: jest.fn(),
    detail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    assignShop: jest.fn(),
    updateSale: jest.fn(),
    toggleDepositorPayment: jest.fn(),
    changeStatus: jest.fn(),
    setOnline: jest.fn(),
    markRemovalDone: jest.fn(),
    markRemovalsDone: jest.fn(),
    listRemovals: jest.fn(),
    delete: jest.fn(),
  } as unknown as ProductsService;
  const controller = new ProductsController(service);

  it('est monté sur /products', () => {
    expect(prefix(ProductsController)).toBe('products');
  });

  it.each([
    ['list', 'GET', '/'],
    ['exportCsv', 'GET', 'export'],
    ['removals', 'GET', 'removals'],
    ['detail', 'GET', ':id'],
    ['create', 'POST', '/'],
    ['createLot', 'POST', 'lot'],
    ['sellMany', 'POST', 'sale'],
    ['update', 'PUT', ':id'],
    ['assignShop', 'PUT', ':id/assign-shop'],
    ['updateSale', 'PUT', ':id/sale'],
    ['depositorPayment', 'PUT', ':id/depositor-payment'],
    ['removalsDone', 'PUT', 'removals-done'],
    ['setOnline', 'PUT', ':id/online'],
    ['removalDone', 'PUT', ':id/removal-done'],
    ['changeStatus', 'PUT', ':id/status'],
    ['delete', 'DELETE', ':id'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(ProductsController, name)).toMatchObject({ method, path });
  });

  it.each([
    ['list', 'products.view'],
    ['exportCsv', 'export.csv'],
    ['detail', 'products.view'],
    ['create', 'products.manage'],
    ['createLot', 'products.manage'],
    ['update', 'products.manage'],
    ['assignShop', 'products.manage'],
    ['updateSale', 'products.manage'],
    ['depositorPayment', 'deposits.manage'],
    ['setOnline', 'online.manage'],
    ['delete', 'products.delete'],
  ])('%s exige la permission %s', (name, permission) => {
    expect(route(ProductsController, name).permissions).toEqual([permission].flat());
  });

  // Deux routes acceptent l'un OU l'autre droit. `changeStatus` est la plus
  // délicate : le garde ne peut pas distinguer une vente en ligne d'un autre
  // changement — le statut visé est dans le corps — donc il ouvre largement et
  // le service resserre. Voir `requireStatusRight`.
  it.each([
    ['sellMany', ['products.changeStatus', 'online.manage']],
    ['removalDone', ['online.manage', 'products.manage']],
    ['removalsDone', ['online.manage', 'products.manage']],
    ['removals', ['online.manage', 'products.manage']],
    ['changeStatus', ['products.changeStatus', 'online.manage']],
  ])('%s accepte l’un ou l’autre de %s', (name, permissions) => {
    const info = route(ProductsController, name);
    expect(info.permissionMode).toBe('any');
    expect(info.permissions).toEqual(permissions);
  });

  it.each([
    'detail',
    'update',
    'assignShop',
    'updateSale',
    'depositorPayment',
    'setOnline',
    'removalDone',
    'changeStatus',
    'delete',
  ])('%s retrouve la boutique via le produit ciblé', (name) => {
    expect(route(ProductsController, name).shopSourceParam).toBe('id');
  });

  describe('délégation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('list appelle list', () => {
      void controller.list(manager, {});
      expect(service.list).toHaveBeenCalledWith(manager, {});
    });

    it('detail appelle detail', () => {
      void controller.detail(manager, 'p1');
      expect(service.detail).toHaveBeenCalledWith(manager, 'p1');
    });

    it('create appelle create', () => {
      void controller.create(manager, {
        name: 'Sac',
        categoryId: 'c1',
        saleType: 'RESALE' as const,
      });
      expect(service.create).toHaveBeenCalledWith(manager, {
        name: 'Sac',
        categoryId: 'c1',
        saleType: 'RESALE',
      });
    });

    it('update appelle update', () => {
      void controller.update(manager, 'p1', { name: 'x' });
      expect(service.update).toHaveBeenCalledWith(manager, 'p1', { name: 'x' });
    });

    it('assignShop appelle assignShop', () => {
      void controller.assignShop(manager, 'p1', {});
      expect(service.assignShop).toHaveBeenCalledWith(manager, 'p1', {});
    });

    it('updateSale appelle updateSale', () => {
      void controller.updateSale(manager, 'p1', { soldPrice: 10 });
      expect(service.updateSale).toHaveBeenCalledWith(manager, 'p1', { soldPrice: 10 });
    });

    it('setOnline appelle setOnline', () => {
      void controller.setOnline(manager, 'p1', { isOnline: true, onlinePrice: 25 });
      expect(service.setOnline).toHaveBeenCalledWith(manager, 'p1', {
        isOnline: true,
        onlinePrice: 25,
      });
    });

    it('removals appelle listRemovals avec la recherche', () => {
      void controller.removals(manager, 'bott');
      expect(service.listRemovals).toHaveBeenCalledWith(manager, 'bott');
    });

    it('removalsDone appelle markRemovalsDone', () => {
      void controller.removalsDone(manager, { productIds: ['p1', 'p2'] });
      expect(service.markRemovalsDone).toHaveBeenCalledWith(manager, {
        productIds: ['p1', 'p2'],
      });
    });

    it('removalDone appelle markRemovalDone', () => {
      void controller.removalDone(manager, 'p1');
      expect(service.markRemovalDone).toHaveBeenCalledWith(manager, 'p1');
    });

    it('changeStatus appelle changeStatus', () => {
      void controller.changeStatus(manager, 'p1', { statusId: 's1' });
      expect(service.changeStatus).toHaveBeenCalledWith(manager, 'p1', { statusId: 's1' });
    });

    it('exportCsv nomme le fichier du jour et le sert en text/csv', async () => {
      const response = { set: jest.fn() };
      (service.exportCsv as jest.Mock).mockResolvedValue('csv');
      await expect(controller.exportCsv(manager, {}, response as never)).resolves.toBe('csv');
      const entetes = response.set.mock.calls[0][0] as Record<string, string>;
      expect(entetes['Content-Type']).toBe('text/csv; charset=utf-8');
      expect(entetes['Content-Disposition']).toMatch(
        /attachment; filename="stock-\d{4}-\d{2}-\d{2}\.csv"/,
      );
    });

    it('depositorPayment transmet le drapeau de règlement', () => {
      void controller.depositorPayment(manager, 'p1', { paid: true });
      expect(service.toggleDepositorPayment).toHaveBeenCalledWith(manager, 'p1', true);
    });

    it('createLot passe le lot entier', () => {
      const lot = { totalPurchasePrice: 7, lines: [{ name: 'T-shirt', categoryId: 'c1' }] };
      void controller.createLot(manager, lot);
      expect(service.createLot).toHaveBeenCalledWith(manager, lot);
    });

    it('sellMany passe le panier entier', () => {
      const panier = { lines: [{ productId: 'p1', soldPrice: 32 }] };
      void controller.sellMany(manager, panier);
      expect(service.sellMany).toHaveBeenCalledWith(manager, panier);
    });

    it('delete appelle delete', () => {
      void controller.delete(manager, 'p1');
      expect(service.delete).toHaveBeenCalledWith(manager, 'p1');
    });
  });
});
