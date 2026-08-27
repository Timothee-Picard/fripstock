/**
 * Répartition du prix d'un lot, pour l'aperçu à l'écran.
 *
 * Le calcul qui fait foi est celui de l'API (`lot-split.ts` côté serveur) : ce
 * jumeau ne sert qu'à montrer le résultat avant de valider. Les deux doivent
 * rendre les mêmes centimes, sinon l'aperçu ment — d'où des tests identiques
 * des deux côtés.
 */
export function splitCost(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const cents = Math.round(total * 100);
  const somme = weights.reduce((t, w) => t + Math.max(0, w), 0);
  const utiles = somme > 0 ? weights.map((w) => Math.max(0, w)) : weights.map(() => 1);
  const totalPoids = utiles.reduce((t, w) => t + w, 0);

  const exactes = utiles.map((w) => (cents * w) / totalPoids);
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
