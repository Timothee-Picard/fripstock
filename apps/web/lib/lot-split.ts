/**
 * Répartition du prix d'un lot, pour l'aperçu à l'écran.
 *
 * Le calcul qui fait foi est celui de l'API (`lot-split.ts` côté serveur) : ce
 * jumeau ne sert qu'à montrer le résultat avant de valider. Les deux doivent
 * rendre les mêmes centimes, sinon l'aperçu ment — d'où des tests identiques
 * des deux côtés.
 */

/**
 * Poids d'un article : son prix de vente, ou `null` s'il n'est pas encore fixé.
 * `0` est un prix décidé — un article donné — et ne porte donc rien du lot.
 */
export type Weight = number | null | undefined;

export function splitCost(total: number, weights: Weight[]): number[] {
  if (weights.length === 0) return [];

  // Un article non étiqueté a quand même coûté quelque chose : il prend la
  // moyenne de ceux dont le prix est connu, plutôt que zéro.
  const fixes = weights.filter((w): w is number => w !== null && w !== undefined);
  const sommeFixes = fixes.reduce((t, w) => t + Math.max(0, w), 0);
  const moyenne = fixes.length > 0 ? sommeFixes / fixes.length : 0;

  const utiles = weights.map((w) => (w === null || w === undefined ? moyenne : Math.max(0, w)));
  const totalPoids = utiles.reduce((t, w) => t + w, 0);
  const finaux = totalPoids > 0 ? utiles : weights.map(() => 1);
  const sommePoids = finaux.reduce((t, w) => t + w, 0);

  const cents = Math.round(total * 100);
  const exactes = finaux.map((w) => (cents * w) / sommePoids);
  const planchers = exactes.map(Math.floor);
  let reste = cents - planchers.reduce((t, c) => t + c, 0);

  const ordre = exactes
    .map((exacte, index) => ({ index, reste: exacte - Math.floor(exacte) }))
    .sort((a, b) => b.reste - a.reste || a.index - b.index);

  const parts = [...planchers];
  for (const { index } of ordre) {
    if (reste <= 0) break;
    parts[index] += 1;
    reste -= 1;
  }

  return parts.map((c) => c / 100);
}
