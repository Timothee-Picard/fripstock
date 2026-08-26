import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthUser } from './current-user.decorator';
import { EmailNormalise } from './email-normalise.decorator';
import { ManagerOnly, MANAGER_KEY } from './manager.decorator';
import { Public, PUBLIC_KEY } from './public.decorator';
import { PERMISSION_KEY, RequirePermission } from './require-permission.decorator';
import { SHOP_SOURCE_KEY, ShopFromResource } from './shop-source.decorator';
import { manager } from '../../test/fixtures';

/**
 * Nest range la fabrique d'un décorateur de paramètre dans les métadonnées de
 * la méthode décorée : on la récupère là pour l'exécuter, sans monter
 * d'application.
 */
function factoryDe(cls: object, methode: string) {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, cls.constructor, methode) as Record<
    string,
    { factory: (data: unknown, ctx: unknown) => unknown }
  >;
  return Object.values(args)[0].factory;
}

class Cible {
  identite(@AuthUser() currentUser: unknown) {
    return currentUser;
  }

  @Public()
  publique() {}

  @ManagerOnly()
  gerant() {}

  @RequirePermission('products.view')
  permission() {}

  @ShopFromResource('id', () => Promise.resolve('shop-1'))
  ressource() {}
}

describe('décorateurs', () => {
  it('@Public marque la route comme ouverte', () => {
    expect(Reflect.getMetadata(PUBLIC_KEY, Cible.prototype.publique)).toBe(true);
  });

  it('@ManagerOnly marque la route comme réservée', () => {
    expect(Reflect.getMetadata(MANAGER_KEY, Cible.prototype.gerant)).toBe(true);
  });

  it('@RequirePermission enregistre la clé demandée', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, Cible.prototype.permission)).toBe('products.view');
  });

  it('@ShopFromResource enregistre le paramètre et son résolveur', () => {
    const source = Reflect.getMetadata(SHOP_SOURCE_KEY, Cible.prototype.ressource) as {
      param: string;
      resolver: unknown;
    };
    expect(source.param).toBe('id');
    expect(typeof source.resolver).toBe('function');
  });

  describe('@EmailNormalise', () => {
    class AvecEmail {
      @EmailNormalise()
      email!: string;
    }

    it('normalise avant de valider — un email entouré d’espaces reste valide', () => {
      const instance = plainToInstance(AvecEmail, { email: '  Alice@Test.FR ' });
      expect(instance.email).toBe('alice@test.fr');
      expect(validateSync(instance)).toEqual([]);
    });

    it('rejette tout de même ce qui n’est pas un email', () => {
      const instance = plainToInstance(AvecEmail, { email: 'pas un email' });
      expect(validateSync(instance).length).toBeGreaterThan(0);
    });

    it('laisse passer une valeur non textuelle à la validation, qui la refuse', () => {
      const instance = plainToInstance(AvecEmail, { email: 42 });
      expect(validateSync(instance).length).toBeGreaterThan(0);
    });
  });

  it("l'utilisateur courant est lu sur la requête, jamais sur le corps", () => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: manager, body: { userId: 'pirate' } }) }),
    };
    expect(factoryDe(Cible.prototype, 'identite')(undefined, ctx)).toBe(manager);
  });
});
