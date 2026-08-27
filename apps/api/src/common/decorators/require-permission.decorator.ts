import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const PERMISSION_KEY = 'requiredPermission';

/** Ce que le garde doit vérifier : toutes les permissions, ou au moins une. */
export interface PermissionRule {
  mode: 'all' | 'any';
  permissions: Permission[];
}

/**
 * Exige **toutes** les permissions citées sur la boutique ciblée.
 *
 * Une route qui fait deux choses doit les nommer toutes les deux : créer un
 * contrat de dépôt crée aussi les produits qui y figurent, et n'exiger que
 * `deposits.manage` ouvrait une porte dérobée vers la création de produits.
 *
 * Le `PermissionsGuard` retrouve la boutique de trois façons — voir le
 * commentaire en tête de permissions.guard.ts. Indique toujours laquelle
 * s'applique en commentaire sur la route décorée.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_KEY, { mode: 'all', permissions } satisfies PermissionRule);

/**
 * Exige **au moins une** des permissions citées.
 *
 * Pour une lecture qu'un second droit rend indispensable : gérer les contrats
 * de dépôt suppose de voir la liste des déposants, sans pour autant donner le
 * droit de les modifier. Exiger `depositors.manage` y aurait rendu le premier
 * droit inutilisable.
 */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_KEY, { mode: 'any', permissions } satisfies PermissionRule);
