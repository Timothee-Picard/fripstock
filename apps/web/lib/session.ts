import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError, COOKIE_NAME } from './api';
import type { Session } from './types';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours, comme l'expiration du JWT.

/**
 * Le drapeau `Secure` se déduit du protocole réellement servi, pas de
 * `NODE_ENV`.
 *
 * Un `Set-Cookie; Secure` reçu sur une origine `http://` est **jeté sans un
 * mot** par le navigateur : le jeton n'est jamais stocké. L'écran qui suit la
 * connexion s'affiche pourtant — il lit le cookie dans le store mémoire de
 * Next, pas dans le navigateur — et la déconnexion ne se voit qu'au clic
 * suivant. C'est exactement ce qui arrive derrière un Coolify encore sans
 * certificat, où l'application est déployée en production mais servie en
 * clair.
 *
 * Le protocole vient de `x-forwarded-proto`, posé par le proxy : le client ne
 * peut pas le forger pour dégrader le cookie, sa requête traverse toujours le
 * proxy qui réécrit l'en-tête. Dès que le domaine reçoit un vrai certificat,
 * `Secure` revient de lui-même, sans variable à penser à poser.
 */
async function isHttps(): Promise<boolean> {
  // Plusieurs proxies en chaîne empilent les valeurs : le premier est celui vu
  // par le client, et c'est le seul qui dit sur quoi son cookie va voyager.
  const forwarded = (await headers()).get('x-forwarded-proto');
  return forwarded?.split(',')[0].trim().toLowerCase() === 'https';
}

/**
 * Le jeton est déposé dans un cookie **httpOnly** : il n'est jamais lisible par
 * le JavaScript de la page, donc une faille XSS ne peut pas l'exfiltrer. Le
 * navigateur ne parle d'ailleurs jamais à l'API directement — tous les appels
 * partent du serveur Next, qui rattache le jeton lui-même.
 *
 * C'est le choix retenu plutôt que localStorage, qui aurait exposé le jeton à
 * n'importe quel script de la page.
 */
export async function setToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isHttps(),
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearToken(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** Session courante, ou `null` si le jeton est absent, expiré ou invalide. */
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await apiFetch<Session>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

/** Session obligatoire : redirige vers la connexion si elle manque. */
export async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (!session) redirect('/login');
  return session;
}
