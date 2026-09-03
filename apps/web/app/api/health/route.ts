/**
 * Sonde de santé du serveur Next, interrogée par le healthcheck du conteneur —
 * c'est cet état-là que Coolify affiche pour l'application, puisque `web` est
 * le seul service à recevoir un domaine.
 *
 * Elle n'appelle pas l'API : elle dit « ce conteneur répond », pas « toute la
 * stack va bien ». Relayer l'API ferait passer `web` en `unhealthy` quand elle
 * tombe, le proxy retirerait le domaine, et il ne resterait plus même une page
 * d'erreur à lire. La dépendance est déjà exprimée là où elle a un sens : le
 * compose de production fait attendre à `web` le vert de `api`.
 */

// Sans cela, un handler qui ne lit pas la requête est pré-rendu au build : la
// sonde répondrait 200 sans rien prouver de l'exécution du serveur.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
