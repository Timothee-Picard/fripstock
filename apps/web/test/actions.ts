import { vi } from 'vitest';

/**
 * Outillage commun aux tests d'actions serveur.
 *
 * Ce qu'on vérifie ici, c'est le contrat avec l'API : la route appelée, la
 * méthode, et surtout les clés du corps — c'est exactement là que se glisse une
 * régression quand un champ est renommé d'un seul côté.
 */
export const apiFetch = vi.fn();
export const publicApiFetch = vi.fn();
export const revalidatePath = vi.fn();
export const redirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});
export const setToken = vi.fn();
export const clearToken = vi.fn();

/** `redirect()` de Next lève : on imite ce contrôle de flux. */
export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`);
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Déclarés au niveau du module : importer ce fichier suffit à poser les
// doubles, sans appel supplémentaire dans chaque test.
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/lib/api', () => ({ apiFetch, publicApiFetch, ApiError }));
vi.mock('@/lib/session', () => ({ setToken, clearToken }));

/**
 * Remet les doubles à zéro *et* leur implémentation : `vi.clearAllMocks()`
 * n'efface que les appels, un `mockRejectedValue` posé par un test fuiterait
 * sur le suivant.
 */
export function resetMocks(reponse: unknown = {}) {
  apiFetch.mockReset().mockResolvedValue(reponse);
  publicApiFetch.mockReset().mockResolvedValue(reponse);
  revalidatePath.mockReset();
  setToken.mockReset();
  clearToken.mockReset();
  redirect.mockReset().mockImplementation((url: string) => {
    throw new RedirectError(url);
  });
}

/** Construit un FormData à partir d'un objet, comme le ferait un formulaire. */
export function form(champs: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(champs)) {
    if (Array.isArray(value)) value.forEach((v) => data.append(key, v));
    else data.set(key, value);
  }
  return data;
}

/** Route, méthode et corps décodé du dernier appel à l'API. */
export function dernierAppel(mock = apiFetch) {
  const [route, options] = mock.mock.calls.at(-1) as [string, RequestInit | undefined];
  return {
    route,
    method: options?.method,
    body: options?.body ? (JSON.parse(String(options.body)) as Record<string, unknown>) : undefined,
  };
}

/** Capture l'URL passée à `redirect()`, que l'action laisse remonter. */
export async function attraperRedirection(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  throw new Error('aucune redirection');
}
