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

/**
 * L'utilisateur détient-il cette permission **sur cette boutique-là** ?
 *
 * `hasPermission` répond « quelque part », ce qui est juste pour un écran
 * transverse et faux dès qu'on vise une boutique : un employé qui tient la
 * caisse à la Gare se voyait proposer le comptoir sur le Centre-ville, où
 * l'API refuse la vente. Offrir une porte fermée n'aide personne.
 *
 * Sans boutique visée, la question redevient « quelque part » : le comptoir
 * cherche alors dans toutes ses boutiques, et l'API tranche article par
 * article.
 */
export function hasPermissionOnShop(
  session: Session,
  permission: Permission,
  shopId?: string,
): boolean {
  if (session.isManager) return true;
  if (!shopId) return hasPermission(session, permission);
  const boutique = session.shops.find((b) => b.shopId === shopId);
  return (
    boutique !== undefined && (boutique.allRights || boutique.permissions.includes(permission))
  );
}
