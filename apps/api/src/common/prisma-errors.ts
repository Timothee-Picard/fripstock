/**
 * Lecture des erreurs de contrainte remontées par Prisma.
 *
 * Sans traduction, une référence déjà prise arrive à l'utilisateur en
 * « Internal server error » : il a simplement saisi un code qui existe, il doit
 * lire lequel.
 */

/** Code Prisma d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * L'erreur est-elle un doublon sur la contrainte qui contient `fragment` ?
 *
 * Prisma 7 avec l'adaptateur de driver ne remplit plus `meta.target` avec les
 * noms de colonnes : le nom de l'index arrive dans une cause imbriquée, dont la
 * forme a déjà changé d'une version à l'autre. On cherche donc le fragment dans
 * l'ensemble des métadonnées, ce qui reste vrai quelle que soit la profondeur.
 */
export function isUniqueViolation(error: unknown, fragment: string): boolean {
  const { code, meta } = (error ?? {}) as { code?: string; meta?: unknown };
  if (code !== UNIQUE_VIOLATION) return false;
  try {
    return JSON.stringify(meta ?? {}).includes(fragment);
  } catch {
    // Métadonnées circulaires : on préfère laisser remonter l'erreur brute
    // plutôt que d'annoncer un doublon dont on n'est pas sûr.
    return false;
  }
}
