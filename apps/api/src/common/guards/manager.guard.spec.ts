import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ManagerGuard } from './manager.guard';
import type { CurrentUser } from '../types/current-user';
import { employee, manager } from '../../test/fixtures';

function context(user?: CurrentUser) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('ManagerGuard', () => {
  function guard(managerRequired: boolean) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(managerRequired) };
    return new ManagerGuard(reflector as unknown as Reflector);
  }

  it('laisse passer une route non décorée, même sans utilisateur', () => {
    expect(guard(false).canActivate(context(undefined))).toBe(true);
  });

  it('laisse passer le gérant sur une route réservée', () => {
    expect(guard(true).canActivate(context(manager))).toBe(true);
  });

  it("refuse l'employé sur une route réservée", () => {
    expect(() => guard(true).canActivate(context(employee))).toThrow(ForbiddenException);
  });

  it('refuse une requête sans utilisateur sur une route réservée', () => {
    expect(() => guard(true).canActivate(context(undefined))).toThrow(ForbiddenException);
  });
});
