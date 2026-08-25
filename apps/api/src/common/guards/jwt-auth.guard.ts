import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CLE_PUBLIC } from '../decorators/public.decorator';

/**
 * Guard JWT global : toute route exige un token, sauf celles marquées @Public
 * (inscription, connexion, sonde de santé).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const estPublic = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (estPublic) return true;
    return super.canActivate(context);
  }
}
