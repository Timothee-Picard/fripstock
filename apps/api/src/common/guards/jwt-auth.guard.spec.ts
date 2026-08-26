import { AuthGuard } from '@nestjs/passport';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const contexte = {
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as never;

  function guard(isPublic: boolean) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) };
    return new JwtAuthGuard(reflector as unknown as Reflector);
  }

  afterEach(() => jest.restoreAllMocks());

  it('laisse passer une route publique sans réclamer de jeton', () => {
    const parent = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');
    expect(guard(true).canActivate(contexte)).toBe(true);
    expect(parent).not.toHaveBeenCalled();
  });

  it('délègue à Passport pour toute autre route', () => {
    const parent = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValue(true);
    expect(guard(false).canActivate(contexte)).toBe(true);
    expect(parent).toHaveBeenCalledWith(contexte);
  });
});
