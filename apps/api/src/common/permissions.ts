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
  'online.manage',
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
  'online.manage': 'Gérer la vente en ligne',
  'categories.manage': 'Gérer les catégories',
  'attributes.manage': 'Gérer les attributs',
  'depositors.manage': 'Gérer les déposants',
  'deposits.manage': 'Gérer les contrats de dépôt',
  'stats.view': 'Voir les chiffres de vente',
  'stock.view': "Voir l'état du stock",
  'export.csv': 'Exporter en CSV',
};

/**
 * Droits qui portent sur l'**entreprise**, pas sur une boutique.
 *
 * Le catalogue, les déposants, les contrats et la boutique en ligne sont
 * uniques pour toute l'entreprise : il n'y a pas une arborescence de catégories
 * par boutique, ni un site par boutique. Les détenir quelque part, c'est donc
 * les détenir partout — le garde n'essaie même pas de résoudre une boutique
 * pour eux.
 *
 * La distinction n'était jusqu'ici qu'un effet de bord : ces droits gouvernaient
 * des routes sans `shopId`, qui tombaient dans le cas « stock central » du
 * garde. `online.manage` a rendu la règle explicite nécessaire — ses routes
 * ciblent un produit, donc une boutique, alors que le site, lui, n'en a pas.
 */
export const COMPANY_PERMISSIONS = new Set<Permission>([
  'categories.manage',
  'attributes.manage',
  'depositors.manage',
  'deposits.manage',
  'online.manage',
]);

export function isCompanyPermission(permission: Permission): boolean {
  return COMPANY_PERMISSIONS.has(permission);
}

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
