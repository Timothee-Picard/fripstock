import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { MANAGER_KEY } from '../decorators/manager.decorator';
import type { CurrentUser } from '../types/current-user';

@Injectable()
export class ManagerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const managerRequired = this.reflector.getAllAndOverride<boolean>(MANAGER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!managerRequired) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    if (!request.user?.isManager) {
      throw new ForbiddenException("Action réservée au gérant de l'entreprise.");
    }
    return true;
  }
}
