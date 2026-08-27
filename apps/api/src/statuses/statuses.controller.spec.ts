import { StatusesController } from './statuses.controller';
import type { StatusesService } from './statuses.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('StatusesController', () => {
  const service = {
    list: jest.fn(),
    checkTransition: jest.fn(),
    defaults: jest.fn(),
  } as unknown as StatusesService;
  const controller = new StatusesController(service);

  it('est monté sur /statuses', () => {
    expect(prefix(StatusesController)).toBe('statuses');
  });

  it('n’expose que la lecture', () => {
    // Les statuts sont des rouages internes : aucun écran ne les modifie, et
    // une route d'écriture sans appelant est une surface offerte pour rien.
    const methodes = Object.getOwnPropertyNames(StatusesController.prototype).filter(
      (n) => n !== 'constructor',
    );
    expect(methodes).toEqual(['list']);
    expect(route(StatusesController, 'list')).toMatchObject({ method: 'GET', path: '/' });
  });

  it('laisse la lecture ouverte à toute l’entreprise', () => {
    // La liste, la fiche et le changement de statut d'un produit en ont besoin.
    expect(route(StatusesController, 'list').permissions).toBeUndefined();
    expect(route(StatusesController, 'list').managerOnly).toBe(false);
  });

  it('list appelle list', () => {
    void controller.list(manager);
    expect(service.list).toHaveBeenCalledWith(manager);
  });
});
