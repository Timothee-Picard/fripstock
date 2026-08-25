/**
 * Clés de permission stockées dans le JSON `AccesBoutique.permissions`.
 *
 * Cette liste est la seule source de vérité. Le JSON n'étant pas typé en base,
 * c'est le seul garde-fou contre une clé mal orthographiée qui accorderait
 * silencieusement un accès — ne jamais écrire ces chaînes en dur ailleurs.
 *
 * Voir la section "Permissions" de CLAUDE.md.
 */
export const PERMISSIONS = [
  'produits.voir',
  'produits.creer',
  'produits.modifier',
  'produits.supprimer',
  'produits.changerStatut',
  'categories.gerer',
  'attributs.gerer',
  'clients.gerer',
  'depots.gerer',
  'stats.voir',
  'export.csv',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions d'un employé sur une boutique donnée. Absent = refusé. */
export type PermissionMap = Partial<Record<Permission, boolean>>;

export function estPermissionValide(valeur: string): valeur is Permission {
  return (PERMISSIONS as readonly string[]).includes(valeur);
}

/**
 * Normalise un JSON venu de la base : on ne garde que les clés connues, et
 * seulement celles explicitement à `true`.
 */
export function lirePermissions(brut: unknown): PermissionMap {
  if (typeof brut !== 'object' || brut === null) return {};
  const source = brut as Record<string, unknown>;
  const resultat: PermissionMap = {};
  for (const cle of PERMISSIONS) {
    if (source[cle] === true) resultat[cle] = true;
  }
  return resultat;
}
