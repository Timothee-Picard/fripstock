import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { PUBLIC_KEY } from '../common/decorators/public.decorator';
import { MANAGER_KEY } from '../common/decorators/manager.decorator';
import { PERMISSION_KEY } from '../common/decorators/require-permission.decorator';
import { SHOP_SOURCE_KEY } from '../common/decorators/shop-source.decorator';

export interface RouteInfo {
  method: string;
  path: string;
  public: boolean;
  managerOnly: boolean;
  permissions?: string[];
  shopSourceParam?: string;
}

/**
 * Lit les métadonnées posées par les décorateurs Nest sur une méthode.
 *
 * C'est ce qui permet de tester le contrat HTTP et les droits exigés sans
 * démarrer d'application : un `@ManagerOnly()` oublié se voit ici.
 */
export function route(controller: new (...args: never[]) => object, name: string): RouteInfo {
  const handler = (controller.prototype as Record<string, unknown>)[name];
  if (typeof handler !== 'function') {
    throw new Error(`${controller.name} n'a pas de méthode ${name}`);
  }
  const source = Reflect.getMetadata(SHOP_SOURCE_KEY, handler) as { param: string } | undefined;
  return {
    method: RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number],
    path: Reflect.getMetadata(PATH_METADATA, handler) as string,
    public: Reflect.getMetadata(PUBLIC_KEY, handler) === true,
    managerOnly: Reflect.getMetadata(MANAGER_KEY, handler) === true,
    permissions: Reflect.getMetadata(PERMISSION_KEY, handler) as string[] | undefined,
    shopSourceParam: source?.param,
  };
}

/** Préfixe déclaré par `@Controller('...')`. */
export function prefix(controller: new (...args: never[]) => object): string {
  return Reflect.getMetadata(PATH_METADATA, controller) as string;
}
