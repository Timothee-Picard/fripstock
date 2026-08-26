import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ get }) }));

const { ApiError, apiFetch, publicApiFetch, tolerantApiFetch } = await import('./api');

function reponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('apiFetch', () => {
  beforeEach(() => {
    get.mockReturnValue({ value: 'jeton' });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('rattache le jeton du cookie', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(200, { ok: true }));
    await apiFetch('/shops');
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton');
  });

  it('n’envoie pas d’en-tête d’autorisation sans cookie', async () => {
    get.mockReturnValue(undefined);
    vi.mocked(fetch).mockResolvedValue(reponse(200, {}));
    await apiFetch('/shops');
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('désactive le cache : le stock change tout le temps', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(200, {}));
    await apiFetch('/products');
    expect(vi.mocked(fetch).mock.calls[0][1]?.cache).toBe('no-store');
  });

  it('rend le corps décodé', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(200, { id: 'p1' }));
    await expect(apiFetch('/products/p1')).resolves.toEqual({ id: 'p1' });
  });

  it('rend undefined sur un 204, qui n’a pas de corps', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('pas de corps')),
    } as unknown as Response);
    await expect(apiFetch('/products/p1')).resolves.toBeUndefined();
  });

  it('remonte le message de l’API tel quel', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(404, { message: 'Produit introuvable.' }));
    await expect(apiFetch('/products/x')).rejects.toThrow('Produit introuvable.');
  });

  it('assemble les messages quand la validation en renvoie plusieurs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse(400, { message: ['name should not be empty', 'categoryId must be a string'] }),
    );
    await expect(apiFetch('/products')).rejects.toThrow(
      'name should not be empty, categoryId must be a string',
    );
  });

  it('retombe sur un message générique quand le corps est illisible', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('html')),
    } as unknown as Response);
    await expect(apiFetch('/products')).rejects.toThrow('Erreur 500');
  });

  it('porte le code HTTP sur l’erreur, pour que l’appelant décide', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(403, { message: 'Interdit' }));
    await expect(apiFetch('/products')).rejects.toMatchObject({ status: 403 });
    await expect(apiFetch('/products')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('publicApiFetch', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('poste le corps sans jeton', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(200, { accessToken: 'x' }));
    await publicApiFetch('/auth/login', { email: 'a@b.fr', password: 'x' });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"email":"a@b.fr","password":"x"}');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('remonte le message de refus', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse(401, { message: 'Email ou mot de passe incorrect.' }),
    );
    await expect(publicApiFetch('/auth/login', {})).rejects.toThrow(
      'Email ou mot de passe incorrect.',
    );
  });
});

describe('tolerantApiFetch', () => {
  beforeEach(() => {
    get.mockReturnValue({ value: 'jeton' });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('rend les données quand tout va bien', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(200, [1, 2]));
    await expect(tolerantApiFetch('/depositors')).resolves.toEqual({ data: [1, 2] });
  });

  it('transforme un refus de droits en état affichable', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(403, { message: 'Interdit' }));
    await expect(tolerantApiFetch('/depositors')).resolves.toEqual({ denied: true });
  });

  it('laisse remonter les vraies pannes', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(500, { message: 'Boum' }));
    await expect(tolerantApiFetch('/depositors')).rejects.toThrow('Boum');
  });

  it("laisse aussi remonter un 404, qui n'est pas un refus de droits", async () => {
    vi.mocked(fetch).mockResolvedValue(reponse(404, { message: 'Introuvable' }));
    await expect(tolerantApiFetch('/depositors/x')).rejects.toThrow('Introuvable');
  });
});
