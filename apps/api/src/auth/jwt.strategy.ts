import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { CurrentUser } from '../common/types/current-user';

export interface JwtPayload {
  sub: string;
  companyId: string;
  isManager: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET manquante : impossible de démarrer.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Ce qui sort d'ici devient `request.user`. On ne recharge pas l'utilisateur
   * en base à chaque requête : les guards qui en ont besoin le font eux-mêmes,
   * avec le scoping qui va bien.
   */
  validate(payload: JwtPayload): CurrentUser {
    if (!payload.sub || !payload.companyId) {
      throw new UnauthorizedException('Jeton invalide.');
    }
    return {
      userId: payload.sub,
      companyId: payload.companyId,
      isManager: payload.isManager === true,
    };
  }
}
