import type { Permission, PermissionMap } from '../permissions';

/** Contenu du JWT, tel que déposé par la stratégie Passport sur la requête. */
export interface UtilisateurCourant {
  userId: string;
  entrepriseId: string;
  estGerant: boolean;
}

/** Accès d'un utilisateur à une boutique, tel que renvoyé par /auth/me. */
export interface AccesBoutiqueResume {
  boutiqueId: string;
  nom: string;
  /** `true` si gérant : tous les droits, sans passer par la table d'accès. */
  tousDroits: boolean;
  permissions: Permission[];
}

export type PermissionsParBoutique = Map<string, PermissionMap>;
