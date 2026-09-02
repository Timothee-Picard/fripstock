import { beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
const get = vi.fn();
const getHeader = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ set, get, delete: vi.fn() }),
  headers: () => Promise.resolve({ get: getHeader }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('./api', () => ({
  apiFetch: vi.fn(),
  ApiError: class extends Error {},
  COOKIE_NAME: 'fripstock_token',
}));

const { setToken } = await import('./session');

/** Les options posées sur le cookie lors du dernier appel. */
function options() {
  return set.mock.calls[0][2] as { secure: boolean; httpOnly: boolean; sameSite: string };
}

describe('setToken', () => {
  beforeEach(() => {
    set.mockReset();
    getHeader.mockReset();
  });

  it('pose Secure derrière un proxy en https', async () => {
    getHeader.mockReturnValue('https');
    await setToken('jeton');
    expect(options().secure).toBe(true);
  });

  it("n'exige pas Secure sur un déploiement servi en clair", async () => {
    // Sinon le navigateur jette le cookie sans un mot, et l'utilisateur est
    // déconnecté au premier clic après la connexion.
    getHeader.mockReturnValue('http');
    await setToken('jeton');
    expect(options().secure).toBe(false);
  });

  it('ne lit que le premier maillon quand les proxies s’empilent', async () => {
    getHeader.mockReturnValue('https, http');
    await setToken('jeton');
    expect(options().secure).toBe(true);
  });

  it('reste en clair quand aucun proxy ne renseigne le protocole', async () => {
    getHeader.mockReturnValue(null);
    await setToken('jeton');
    expect(options().secure).toBe(false);
  });

  it('garde le jeton hors de portée du JavaScript de la page', async () => {
    getHeader.mockReturnValue('https');
    await setToken('jeton');
    expect(options().httpOnly).toBe(true);
    expect(options().sameSite).toBe('lax');
  });
});
