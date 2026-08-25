import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { appelApi, ErreurApi, NOM_COOKIE } from './api';
import type { Session } from './types';

const DUREE_COOKIE = 60 * 60 * 24 * 7; // 7 jours, comme l'expiration du JWT.

/**
 * Le jeton est déposé dans un cookie **httpOnly** : il n'est jamais lisible par
 * le JavaScript de la page, donc une faille XSS ne peut pas l'exfiltrer. Le
 * navigateur ne parle d'ailleurs jamais à l'API directement — tous les appels
 * partent du serveur Next, qui rattache le jeton lui-même.
 *
 * C'est le choix retenu plutôt que localStorage, qui aurait exposé le jeton à
 * n'importe quel script de la page.
 */
export async function poserJeton(jeton: string): Promise<void> {
  (await cookies()).set(NOM_COOKIE, jeton, {
    httpOnly: true,
    sameSite: 'lax',
    // `secure` seulement hors développement : en local on est en http.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE_COOKIE,
  });
}

export async function effacerJeton(): Promise<void> {
  (await cookies()).delete(NOM_COOKIE);
}

/** Session courante, ou `null` si le jeton est absent, expiré ou invalide. */
export async function lireSession(): Promise<Session | null> {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;
  if (!jeton) return null;
  try {
    return await appelApi<Session>('/auth/me');
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.statut === 401 || erreur.statut === 403)) {
      return null;
    }
    throw erreur;
  }
}

/** Session obligatoire : redirige vers la connexion si elle manque. */
export async function exigerSession(): Promise<Session> {
  const session = await lireSession();
  if (!session) redirect('/login');
  return session;
}
