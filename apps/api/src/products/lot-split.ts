/**
 * Répartition du prix d'un lot entre les articles qui le composent.
 *
 * Un achat en lot ne donne qu'un prix global — « 4 t-shirts et 2 chemises pour
 * 7 € ». Chaque article a pourtant besoin de son propre `purchasePrice`, sans
 * quoi la marge affichée par les statistiques est fausse.
 *
 * La part de chacun suit son prix de vente : un article revendu deux fois plus
 * cher porte deux fois plus du coût. Le taux de marge est alors le même
 * partout, et aucun article ne paraît plus rentable qu'un autre par le seul
 * effet du partage.
 */

/**
 * Répartit `total` selon `weights`, en centimes exacts.
 *
 * On travaille en centimes puis on distribue les centimes restants aux plus
 * gros restes (méthode du plus fort reste) : arrondir chaque part isolément
 * ferait que la somme ne retomberait pas sur le prix payé, et le stock
 * afficherait un coût d'achat que personne n'a déboursé.
 *
 * Sans prix de vente — ou avec des prix tous nuls — le partage se fait à parts
 * égales : c'est la seule répartition défendable quand rien ne distingue les
 * articles.
 */
export function splitCost(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const cents = Math.round(total * 100);
  const somme = weights.reduce((t, w) => t + Math.max(0, w), 0);
  // Un poids négatif n'a pas de sens ; un poids absent vaut zéro.
  const utiles = somme > 0 ? weights.map((w) => Math.max(0, w)) : weights.map(() => 1);
  const totalPoids = utiles.reduce((t, w) => t + w, 0);

  const exactes = utiles.map((w) => (cents * w) / totalPoids);
  const planchers = exactes.map(Math.floor);
  let reste = cents - planchers.reduce((t, c) => t + c, 0);

  // Les plus gros restes servis en premier, à égalité le premier arrivé.
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
