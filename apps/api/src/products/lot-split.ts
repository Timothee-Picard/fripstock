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
 * Poids d'un article : son prix de vente, ou `null` s'il n'est pas encore
 * fixé.
 *
 * La nuance compte : `0` est un prix décidé — un article donné — alors que
 * `null` veut dire « on ne sait pas encore ». Les deux ne peuvent pas porter la
 * même part du lot.
 */
export type Weight = number | null | undefined;

/**
 * Répartit `total` selon `weights`, en centimes exacts.
 *
 * Trois cas, du plus fréquent au plus rare :
 *
 * - tous les prix de vente sont connus : chacun porte sa part au prorata ;
 * - certains manquent : ils prennent la moyenne de ceux qui sont fixés. Un
 *   article non étiqueté a quand même coûté quelque chose, et lui donner zéro
 *   ferait porter tout le lot aux autres — leur marge s'effondrerait sans
 *   raison ;
 * - aucun n'est connu : partage à parts égales, seule répartition défendable
 *   quand rien ne distingue les articles.
 *
 * On travaille en centimes puis on distribue les centimes restants aux plus
 * gros restes (méthode du plus fort reste) : arrondir chaque part isolément
 * ferait que la somme ne retomberait pas sur le prix payé, et le stock
 * afficherait un coût d'achat que personne n'a déboursé.
 */
export function splitCost(total: number, weights: Weight[]): number[] {
  if (weights.length === 0) return [];

  // Un poids négatif n'a pas de sens : on le traite comme un prix à zéro.
  const fixes = weights.filter((w): w is number => w !== null && w !== undefined);
  const sommeFixes = fixes.reduce((t, w) => t + Math.max(0, w), 0);
  const moyenne = fixes.length > 0 ? sommeFixes / fixes.length : 0;

  const utiles = weights.map((w) => (w === null || w === undefined ? moyenne : Math.max(0, w)));
  const totalPoids = utiles.reduce((t, w) => t + w, 0);
  // Plus rien pour départager : parts égales.
  const finaux = totalPoids > 0 ? utiles : weights.map(() => 1);
  const sommePoids = finaux.reduce((t, w) => t + w, 0);

  const cents = Math.round(total * 100);
  const exactes = finaux.map((w) => (cents * w) / sommePoids);
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
