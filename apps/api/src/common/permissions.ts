/**
 * Clés de permission stockées dans le JSON `ShopAccess.permissions`.
 *
 * Cette liste est la seule source de vérité. Le JSON n'étant pas typé en base,
 * c'est le seul garde-fou contre une clé mal orthographiée qui accorderait
 * silencieusement un accès — ne jamais écrire ces chaînes en dur ailleurs.
 *
 * Voir la section "Permissions" de CLAUDE.md.
 */
export const PERMISSIONS = [
  'products.view',
  'products.manage',
  'products.delete',
  'products.changeStatus',
  'categories.manage',
  'attributes.manage',
  'depositors.manage',
  'deposits.manage',
  'stats.view',
  'stock.view',
  'export.csv',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Libellés lisibles des permissions.
 *
 * Une clé technique n'a rien à faire sous les yeux d'un utilisateur : un refus
 * doit nommer le droit tel qu'il apparaît sur l'écran des accès, sinon
 * l'employé ne sait pas quoi demander à son gérant.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'products.view': 'Voir les produits',
  'products.manage': 'Créer et modifier des produits',
  'products.delete': 'Supprimer des produits',
  'products.changeStatus': 'Vendre et changer le statut',
  'categories.manage': 'Gérer les catégories',
  'attributes.manage': 'Gérer les attributs',
  'depositors.manage': 'Gérer les déposants',
  'deposits.manage': 'Gérer les contrats de dépôt',
  'stats.view': 'Voir les chiffres de vente',
  'stock.view': "Voir l'état du stock",
  'export.csv': 'Exporter en CSV',
};

/** Permissions d'un employé sur une boutique donnée. Absent = refusé. */
export type PermissionMap = Partial<Record<Permission, boolean>>;

export function isValidPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Normalise un JSON venu de la base : on ne garde que les clés connues, et
 * seulement celles explicitement à `true`.
 */
export function readPermissions(raw: unknown): PermissionMap {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const result: PermissionMap = {};
  for (const key of PERMISSIONS) {
    if (source[key] === true) result[key] = true;
  }
  return result;
}
