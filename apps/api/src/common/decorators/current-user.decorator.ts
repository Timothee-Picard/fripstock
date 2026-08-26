import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from '../types/current-user';

/**
 * Injecte l'utilisateur déduit du JWT.
 *
 * C'est la seule source autorisée pour `companyId` : ne jamais le lire dans
 * le body ou les params, sous peine de fuite entre entreprises.
 */
export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const requete = ctx.switchToHttp().getRequest<Request & { user: CurrentUser }>();
    return requete.user;
  },
);
