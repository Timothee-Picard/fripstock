import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SHOP_SOURCE_KEY, type ShopSource } from '../decorators/shop-source.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PERMISSION_LABELS, readPermissions, type Permission } from '../permissions';
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
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentification requise.');

    // Le gérant a tous les droits sur toutes les boutiques de son entreprise.
    if (user.isManager) return true;

    const shopId = await this.findShop(context, request, user);

    if (shopId === null) {
      // Cas 3 : stock central.
      const compte = await this.prisma.shopAccess.count({
        where: {
          userId: user.userId,
          // Scoping par la relation, comme partout : `ShopAccess` n'a pas de
          // colonne companyId.
          shop: { companyId: user.companyId },
          permissions: { path: [permission], equals: true },
        },
      });
      if (compte === 0) this.deny(permission, false);
      return true;
    }

    const accesses = await this.prisma.shopAccess.findFirst({
      where: {
        userId: user.userId,
        shopId,
        // Le scoping passe par la relation : `shopId` vient du déposant, il
        // ne prouve rien tant qu'on n'a pas vérifié qu'il appartient bien à
        // l'entreprise de l'user.
        shop: { companyId: user.companyId },
      },
      select: { permissions: true },
    });

    if (!accesses || readPermissions(accesses.permissions)[permission] !== true) {
      this.deny(permission, true);
    }
    return true;
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
