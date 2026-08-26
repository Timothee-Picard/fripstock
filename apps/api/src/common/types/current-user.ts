import type { Permission, PermissionMap } from '../permissions';

/** Contenu du JWT, tel que déposé par la stratégie Passport sur la requête. */
export interface CurrentUser {
  userId: string;
  companyId: string;
  isManager: boolean;
}

/** Accès d'un utilisateur à une boutique, tel que renvoyé par /auth/me. */
export interface ShopAccessSummary {
  shopId: string;
  name: string;
  /** `true` si gérant : tous les droits, sans passer par la table d'accès. */
  allRights: boolean;
  permissions: Permission[];
}

export type PermissionsByShop = Map<string, PermissionMap>;
