import { cookies } from 'next/headers';

/**
 * URL interne au réseau docker : tous les appels partent du serveur Next, le
 * navigateur ne parle jamais directement à l'API.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export const NOM_COOKIE = 'fripstock_token';

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
  }
}

function messageDErreur(corps: unknown, statut: number): string {
  if (typeof corps === 'object' && corps !== null && 'message' in corps) {
    const m = (corps as { message: unknown }).message;
    // Nest renvoie un tableau quand plusieurs règles de validation échouent.
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return `Erreur ${statut}`;
}

/** Appel authentifié à l'API, côté serveur uniquement. */
export async function appelApi<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;

  const reponse = await fetch(`${API_URL}${chemin}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...options.headers,
    },
  });

  if (!reponse.ok) {
    const corps: unknown = await reponse.json().catch(() => null);
    throw new ErreurApi(reponse.status, messageDErreur(corps, reponse.status));
  }
  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

/** Appel non authentifié — inscription et connexion. */
export async function appelApiPublic<T>(chemin: string, corps: unknown): Promise<T> {
  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!reponse.ok) {
    const erreur: unknown = await reponse.json().catch(() => null);
    throw new ErreurApi(reponse.status, messageDErreur(erreur, reponse.status));
  }
  return (await reponse.json()) as T;
}
