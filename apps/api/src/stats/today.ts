/**
 * Bornes de la journée en cours, dans le fuseau de la boutique.
 *
 * Le conteneur tourne en UTC : prendre minuit UTC ferait basculer les ventes
 * françaises de 00 h à 02 h dans la veille. On calcule donc la journée telle
 * que la boutique la vit.
 */

/** Fuseau de la boutique. Une entreprise, un fuseau — suffisant pour le MVP. */
export const SHOP_TIMEZONE = process.env.SHOP_TIMEZONE ?? 'Europe/Paris';

/**
 * Décalage du fuseau à cet instant précis, en millisecondes.
 *
 * Recalculé à chaque appel plutôt que figé : il change deux fois par an, et une
 * constante posée au démarrage serait fausse dès le changement d'heure suivant.
 */
function offset(instant: Date, timeZone: string): number {
  const enUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  const surPlace = new Date(instant.toLocaleString('en-US', { timeZone }));
  return surPlace.getTime() - enUtc.getTime();
}

/**
 * Début et fin de la journée en cours, en instants UTC comparables en base,
 * plus le jour calendaire lui-même.
 *
 * `day` n'est pas redondant avec `from` : un instant se reformate dans le
 * fuseau de celui qui l'affiche, et le serveur Next tourne en UTC — minuit à
 * Paris y redevenait la veille, et la bannière « Aujourd'hui » datait d'hier.
 * Une date calendaire ne souffre pas de ce glissement.
 */
export function dayBounds(
  now: Date = new Date(),
  timeZone: string = SHOP_TIMEZONE,
): { from: Date; to: Date; day: string } {
  // `en-CA` rend la date au format AAAA-MM-JJ, directement réutilisable.
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const minuitLocal = Date.parse(`${jour}T00:00:00Z`) - offset(now, timeZone);
  return { from: new Date(minuitLocal), to: new Date(minuitLocal + 86400000 - 1), day: jour };
}
