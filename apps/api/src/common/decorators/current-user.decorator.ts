import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UtilisateurCourant } from '../types/utilisateur-courant';

/**
 * Injecte l'utilisateur déduit du JWT.
 *
 * C'est la seule source autorisée pour `entrepriseId` : ne jamais le lire dans
 * le body ou les params, sous peine de fuite entre entreprises.
 */
export const Utilisateur = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UtilisateurCourant => {
    const requete = ctx.switchToHttp().getRequest<Request & { user: UtilisateurCourant }>();
    return requete.user;
  },
);
