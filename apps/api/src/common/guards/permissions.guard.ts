import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SHOP_SOURCE_KEY, type ShopSource } from '../decorators/shop-source.decorator';
import { PERMISSION_KEY, type PermissionRule } from '../decorators/require-permission.decorator';
import {
  isCompanyPermission,
  PERMISSION_LABELS,
  readPermissions,
  type Permission,
} from '../permissions';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../types/current-user';

/**
 * Vérifie la permission exigée par @RequirePermission sur la boutique visée.
 *
 * Le gérant passe toujours : le bypass est ici, une seule fois, jamais dupliqué
 * route par route.
 *
 * La boutique concernée est retrouvée de trois façons, dans cet ordre :
 *
 *   1. un `shopId` explicite, en paramètre de route, dans le body ou en
 *      query ;
 *   2. une ressource ciblée par `:id`, via @ShopFromResource — la
 *      boutique se lit alors sur la ressource chargée (cas des produits) ;
 *   3. aucune boutique — c'est le stock central (`shopId = null`). La
 *      permission est alors accordée si l'utilisateur la possède dans au moins
 *      une boutique de son entreprise : un employé doit pouvoir créer un
 *      produit avant de savoir où il ira. Voir CLAUDE.md, "Produits non
 *      assignés".
 *
 * Les **droits d'entreprise** (`COMPANY_PERMISSIONS`) court-circuitent tout
 * ça : catalogue, déposants, contrats et boutique en ligne sont uniques pour
 * l'entreprise, donc les détenir quelque part c'est les détenir partout, même
 * quand la route cible une ressource rattachée à une boutique.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<PermissionRule>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule || rule.permissions.length === 0) return true;
    const { mode, permissions } = rule;

    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentification requise.');

    // Le gérant a tous les droits sur toutes les boutiques de son entreprise.
    if (user.isManager) return true;

    const shopId = await this.findShop(context, request, user);

    // Chaque droit s'évalue selon **sa propre** règle, jamais selon celle du
    // lot : une route qui accepte « products.manage ou online.manage » mêle un
    // droit de boutique et un droit d'entreprise, et trancher pour les deux à
    // la fois refuserait le second hors de la boutique où il est coché.
    const detenues: Permission[] = [];
    for (const permission of permissions) {
      if (await this.detient(user, permission, shopId)) detenues.push(permission);
      else if (mode === 'all')
        this.deny(permission, shopId !== null && !isCompanyPermission(permission));
    }

    if (detenues.length === 0) {
      // Le refus nomme la première : c'est celle qui gouverne la route, les
      // autres n'en sont que des équivalents acceptés.
      this.deny(permissions[0], shopId !== null && !isCompanyPermission(permissions[0]));
    }
    return true;
  }

  /**
   * L'utilisateur détient-il ce droit, là où il compte ?
   *
   * Un **droit d'entreprise** se cherche partout : catalogue, déposants,
   * contrats et boutique en ligne sont uniques, il n'y a pas de « par
   * boutique » qui tienne. Même chose pour le stock central, qui n'appartient à
   * aucune boutique — un employé doit pouvoir créer un produit avant de savoir
   * où il ira. Sinon, c'est la boutique visée qui décide.
   */
  private async detient(
    user: CurrentUser,
    permission: Permission,
    shopId: string | null,
  ): Promise<boolean> {
    if (shopId === null || isCompanyPermission(permission)) {
      const compte = await this.prisma.shopAccess.count({
        where: {
          userId: user.userId,
          // Scoping par la relation, comme partout : `ShopAccess` n'a pas de
          // colonne companyId.
          shop: { companyId: user.companyId },
          permissions: { path: [permission], equals: true },
        },
      });
      return compte > 0;
    }

    const acces = await this.prisma.shopAccess.findFirst({
      where: {
        userId: user.userId,
        shopId,
        // Le scoping passe par la relation : `shopId` vient de la ressource, il
        // ne prouve rien tant qu'on n'a pas vérifié qu'il appartient bien à
        // l'entreprise de l'user.
        shop: { companyId: user.companyId },
      },
      select: { permissions: true },
    });
    return readPermissions(acces?.permissions)[permission] === true;
  }

  /** Renvoie l'identifiant de boutique visé, ou `null` pour le stock central. */
  private async findShop(
    context: ExecutionContext,
    request: Request,
    user: CurrentUser,
  ): Promise<string | null> {
    const source = this.reflector.getAllAndOverride<ShopSource | undefined>(SHOP_SOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Cas 2 : la boutique se déduit d'une ressource ciblée par l'URL.
    if (source) {
      const params = request.params as Record<string, string | undefined>;
      const id = params[source.param];
      if (!id) return null;
      const trouve = await source.resolver(this.prisma, id, user.companyId);
      return trouve ?? null;
    }

    // Cas 1 : shopId explicite.
    const params = request.params as Record<string, unknown>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = request.query as Record<string, unknown>;
    for (const source of [params, body, query]) {
      const value = source['shopId'];
      if (typeof value === 'string' && value.length > 0) return value;
    }

    // Cas 3.
    return null;
  }

  /**
   * Refus lisible.
   *
   * `enBoutique` distingue les deux refus possibles : le droit peut exister
   * ailleurs et manquer ici. Sans cette nuance, un employé qui voit
   * « Modifier des produits » coché sur son profil ne comprendrait pas pourquoi
   * l'action échoue sur cette boutique-là.
   */
  private deny(permission: Permission, enBoutique: boolean): never {
    const libelle = PERMISSION_LABELS[permission];
    throw new ForbiddenException(
      enBoutique
        ? `Vous n'avez pas le droit « ${libelle} » sur cette boutique.`
        : `Vous n'avez pas le droit « ${libelle} ».`,
    );
  }
}
