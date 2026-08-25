import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CLE_GERANT } from '../decorators/gerant.decorator';
import type { UtilisateurCourant } from '../types/utilisateur-courant';

@Injectable()
export class GerantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const gerantRequis = this.reflector.getAllAndOverride<boolean>(CLE_GERANT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!gerantRequis) return true;

    const requete = context.switchToHttp().getRequest<Request & { user?: UtilisateurCourant }>();
    if (!requete.user?.estGerant) {
      throw new ForbiddenException("Action réservée au gérant de l'entreprise.");
    }
    return true;
  }
}
