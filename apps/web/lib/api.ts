import { cookies } from 'next/headers';

/**
 * URL interne au réseau docker : tous les appels partent du serveur Next, le
 * navigateur ne parle jamais directement à l'API.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export const COOKIE_NAME = 'fripstock_token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const m = (body as { message: unknown }).message;
    // Nest renvoie un tableau quand plusieurs règles de validation échouent.
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return `Erreur ${status}`;
}

/** Appel authentifié à l'API, côté serveur uniquement. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(body, response.status));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Appel non authentifié — inscription et connexion. */
export async function publicApiFetch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(error, response.status));
  }
  return (await response.json()) as T;
}

/**
 * Appel authentifié tolérant au refus.
 *
 * Un manque de droits n'est pas une panne : plutôt que de laisser remonter
 * l'exception — qui produit une page en erreur illisible — on renvoie
 * `{ refus: true }` et l'écran affiche une explication.
 */
export async function tolerantApiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; denied?: false } | { data?: undefined; denied: true }> {
  try {
    return { data: await apiFetch<T>(path, options) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return { denied: true };
    throw error;
  }
}
