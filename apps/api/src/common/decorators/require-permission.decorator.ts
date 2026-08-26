import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const PERMISSION_KEY = 'permissionRequise';

/**
 * Exige une permission sur la boutique ciblée par la requête.
 *
 * Le `PermissionsGuard` retrouve cette boutique de trois façons — voir le
 * commentaire en tête de permissions.guard.ts. Indique toujours laquelle
 * s'applique en commentaire sur la route décorée.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
