import type { Permission, Session } from './types';

/**
 * L'utilisateur détient-il cette permission quelque part ?
 *
 * Même règle que le `PermissionsGuard` de l'API : le gérant a tous les droits,
 * et pour un employé la permission acquise sur au moins une boutique vaut sur
 * les écrans transverses — catalogue, déposants, statistiques — qui ne visent
 * aucune boutique en particulier.
 *
 * Sert uniquement à ne pas proposer ce qui sera refusé. L'autorisation, elle,
 * est toujours rendue par l'API.
 */
export function hasPermission(session: Session, permission: Permission): boolean {
  if (session.isManager) return true;
  return session.shops.some((b) => b.allRights || b.permissions.includes(permission));
}
