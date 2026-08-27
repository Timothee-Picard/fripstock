import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Exige une ou plusieurs permissions sur la boutique ciblée par la requête.
 *
 * Plusieurs permissions se cumulent — **toutes** sont exigées. Une route qui
 * fait deux choses doit les nommer toutes les deux : créer un contrat de dépôt
 * crée aussi les produits qui y figurent, et n'exiger que `deposits.manage`
 * ouvrait une porte dérobée vers la création de produits.
 *
 * Le `PermissionsGuard` retrouve la boutique de trois façons — voir le
 * commentaire en tête de permissions.guard.ts. Indique toujours laquelle
 * s'applique en commentaire sur la route décorée.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
