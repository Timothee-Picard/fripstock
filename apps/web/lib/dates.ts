/**
 * Formatage des dates affichées.
 *
 * **Toujours dans le fuseau de la boutique, jamais dans celui du navigateur.**
 * Deux raisons, et la première suffirait :
 *
 * 1. Le serveur Next tourne en UTC, le navigateur dans le fuseau de son
 *    utilisateur. Un `toLocaleString` sans `timeZone` rendait donc « 14:55 »
 *    côté serveur et « 16:55 » côté client, et React refusait l'hydratation de
 *    l'historique des statuts.
 * 2. C'est aussi la bonne réponse métier : une vente encaissée à 23 h 30 à
 *    Paris appartient à cette soirée-là, y compris relue depuis un autre
 *    fuseau. La date d'un événement de boutique est celle de la boutique.
 *
 * Passer par ces fonctions plutôt que par `toLocaleDateString` directement :
 * un appel sans fuseau réintroduit le bug, et il ne se voit qu'en production,
 * sur une machine dont l'horloge n'est pas celle du conteneur.
 */

/**
 * Fuseau de la boutique. Une entreprise, un fuseau — même hypothèse et même
 * valeur que `SHOP_TIMEZONE` côté API (`apps/api/src/stats/today.ts`), qui
 * découpe les journées avec.
 *
 * Écrit en dur des deux côtés plutôt que lu dans l'environnement : côté client,
 * Next fige les variables `NEXT_PUBLIC_*` à la construction de l'image, donc
 * une valeur posée dans `docker-compose.yml` ne serait honorée qu'en
 * développement — une configuration qui ne marche qu'à moitié est pire que pas
 * de configuration. Le jour où ce fuseau devient réglable, les deux constantes
 * doivent bouger ensemble : deux fuseaux différents feraient dire à la bannière
 * « Aujourd'hui » autre chose qu'à l'historique juste en dessous.
 */
export const SHOP_TIMEZONE = 'Europe/Paris';

/** Un instant en `27/08/2026`. */
export function formatDate(instant: string | Date): string {
  return new Date(instant).toLocaleDateString('fr-FR', { timeZone: SHOP_TIMEZONE });
}

/** Un instant en `27/08/2026 16:55`. */
export function formatDateTime(instant: string | Date): string {
  return new Date(instant).toLocaleString('fr-FR', {
    timeZone: SHOP_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Un instant en `27/08` — pour un axe de graphique, où la place manque. */
export function formatShortDate(instant: string | Date): string {
  return new Date(instant).toLocaleDateString('fr-FR', {
    timeZone: SHOP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Un **jour calendaire** (`AAAA-MM-JJ`), qui n'est pas un instant.
 *
 * Lu à midi UTC et formaté en UTC : ainsi aucun décalage de fuseau, dans un
 * sens ou dans l'autre, ne peut le faire glisser sur la veille ou le lendemain.
 * Minuit ne laisserait que douze heures de marge d'un côté et zéro de l'autre.
 */
export function formatCalendarDay(day: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    ...options,
  });
}
