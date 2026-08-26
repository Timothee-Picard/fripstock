import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError, COOKIE_NAME } from './api';
import type { Session } from './types';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours, comme l'expiration du JWT.

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
    // `secure` seulement hors développement : en local on est en http.
    secure: process.env.NODE_ENV === 'production',
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
