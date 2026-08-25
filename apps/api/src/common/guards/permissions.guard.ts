import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CLE_SOURCE_BOUTIQUE, type SourceBoutique } from '../decorators/boutique-source.decorator';
import { CLE_PERMISSION } from '../decorators/require-permission.decorator';
import { lirePermissions, type Permission } from '../permissions';
import { PrismaService } from '../../prisma/prisma.service';
import type { UtilisateurCourant } from '../types/utilisateur-courant';

/**
 * Vérifie la permission exigée par @RequirePermission sur la boutique visée.
 *
 * Le gérant passe toujours : le bypass est ici, une seule fois, jamais dupliqué
 * route par route.
 *
 * La boutique concernée est retrouvée de trois façons, dans cet ordre :
 *
 *   1. un `boutiqueId` explicite, en paramètre de route, dans le body ou en
 *      query ;
 *   2. une ressource ciblée par `:id`, via @BoutiqueDepuisRessource — la
 *      boutique se lit alors sur la ressource chargée (cas des produits) ;
 *   3. aucune boutique — c'est le stock central (`boutiqueId = null`). La
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
    const permission = this.reflector.getAllAndOverride<Permission>(CLE_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const requete = context.switchToHttp().getRequest<Request & { user?: UtilisateurCourant }>();
    const utilisateur = requete.user;
    if (!utilisateur) throw new ForbiddenException('Authentification requise.');

    // Le gérant a tous les droits sur toutes les boutiques de son entreprise.
    if (utilisateur.estGerant) return true;

    const boutiqueId = await this.trouverBoutique(context, requete, utilisateur);

    if (boutiqueId === null) {
      // Cas 3 : stock central.
      const compte = await this.prisma.accesBoutique.count({
        where: {
          userId: utilisateur.userId,
          permissions: { path: [permission], equals: true },
        },
      });
      if (compte === 0) this.refuser(permission);
      return true;
    }

    const acces = await this.prisma.accesBoutique.findFirst({
      where: {
        userId: utilisateur.userId,
        boutiqueId,
        // Le scoping passe par la relation : `boutiqueId` vient du client, il
        // ne prouve rien tant qu'on n'a pas vérifié qu'il appartient bien à
        // l'entreprise de l'utilisateur.
        boutique: { entrepriseId: utilisateur.entrepriseId },
      },
      select: { permissions: true },
    });

    if (!acces || lirePermissions(acces.permissions)[permission] !== true) {
      this.refuser(permission);
    }
    return true;
  }

  /** Renvoie l'identifiant de boutique visé, ou `null` pour le stock central. */
  private async trouverBoutique(
    context: ExecutionContext,
    requete: Request,
    utilisateur: UtilisateurCourant,
  ): Promise<string | null> {
    const source = this.reflector.getAllAndOverride<SourceBoutique | undefined>(
      CLE_SOURCE_BOUTIQUE,
      [context.getHandler(), context.getClass()],
    );

    // Cas 2 : la boutique se déduit d'une ressource ciblée par l'URL.
    if (source) {
      const params = requete.params as Record<string, string | undefined>;
      const id = params[source.param];
      if (!id) return null;
      const trouve = await source.resolveur(this.prisma, id, utilisateur.entrepriseId);
      return trouve ?? null;
    }

    // Cas 1 : boutiqueId explicite.
    const params = requete.params as Record<string, unknown>;
    const body = (requete.body ?? {}) as Record<string, unknown>;
    const query = requete.query as Record<string, unknown>;
    for (const source of [params, body, query]) {
      const valeur = source['boutiqueId'];
      if (typeof valeur === 'string' && valeur.length > 0) return valeur;
    }

    // Cas 3.
    return null;
  }

  private refuser(permission: Permission): never {
    throw new ForbiddenException(`Permission manquante : ${permission}`);
  }
}
