import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ get }) }));

const apiFetch = vi.fn();
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
vi.mock('@/lib/api', () => ({ apiFetch, ApiError, COOKIE_NAME: 'fripstock_token' }));

const exporter = await import('./export/route');
const photos = await import('./photos/route');
const photo = await import('./photos/[...key]/route');
const attributs = await import('./categories/[id]/attributes/route');
const recherche = await import('./products/search/route');

/** Une réponse d'API avec un corps diffusable. */
function amont(status: number, headers: Record<string, string> = {}, corps = 'contenu') {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: corps ? new ReadableStream() : null,
    headers: new Headers(headers),
    json: () => Promise.resolve({ key: 'c1/x.png' }),
    formData: () => Promise.resolve(new FormData()),
  } as unknown as Response;
}

beforeEach(() => {
  get.mockReturnValue({ value: 'jeton' });
  apiFetch.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

describe('GET /api/export', () => {
  it('refuse sans session — le lien ne porte pas de jeton', async () => {
    get.mockReturnValue(undefined);
    const r = await exporter.GET(new Request('http://x/api/export'));
    expect(r.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rattache le jeton et recopie les filtres tels quels', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(200));
    await exporter.GET(new Request('http://x/api/export?saleType=CONSIGNMENT&search=bott'));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/products/export?saleType=CONSIGNMENT&search=bott');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton');
  });

  it('transmet le nom de fichier proposé par l’API', async () => {
    vi.mocked(fetch).mockResolvedValue(
      amont(200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="stock-2026-08-26.csv"',
      }),
    );
    const r = await exporter.GET(new Request('http://x/api/export'));
    expect(r.headers.get('content-disposition')).toContain('stock-2026-08-26.csv');
  });

  it('retombe sur un nom générique si l’API n’en donne pas', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(200));
    const r = await exporter.GET(new Request('http://x/api/export'));
    expect(r.headers.get('content-disposition')).toContain('stock.csv');
    expect(r.headers.get('content-type')).toContain('text/csv');
  });

  it('relaie le refus de l’API plutôt que de servir un fichier vide', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(403, {}, ''));
    const r = await exporter.GET(new Request('http://x/api/export'));
    expect(r.status).toBe(403);
  });
});

describe('POST /api/photos', () => {
  /**
   * Requête multipart minimale. On ne construit pas de vrai corps : jsdom et
   * undici n'ont pas la même classe `File`, et seul `formData()` nous intéresse.
   */
  function envoi() {
    return {
      method: 'POST',
      formData: () => Promise.resolve(new FormData()),
    } as unknown as Request;
  }

  it('refuse sans session', async () => {
    get.mockReturnValue(undefined);
    const r = await photos.POST(envoi());
    expect(r.status).toBe(401);
  });

  it('relaie le multipart avec le jeton', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(201));
    const r = await photos.POST(envoi());
    expect(r.status).toBe(201);
    await expect(r.json()).resolves.toEqual({ key: 'c1/x.png' });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/uploads/photo');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton');
  });

  it('reste lisible si l’API répond sans corps JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 500,
      json: () => Promise.reject(new Error('html')),
      formData: () => Promise.resolve(new FormData()),
    } as unknown as Response);
    const r = await photos.POST(envoi());
    await expect(r.json()).resolves.toEqual({ message: 'Envoi impossible.' });
  });
});

describe('GET /api/photos/[...key]', () => {
  const params = (key: string[]) => ({ params: Promise.resolve({ key }) });

  it('refuse sans session : une photo reste inaccessible hors session', async () => {
    get.mockReturnValue(undefined);
    const r = await photo.GET(new Request('http://x'), params(['c1', 'x.png']));
    expect(r.status).toBe(401);
  });

  it('recolle la clé et échappe chaque segment', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(200, { 'content-type': 'image/png' }));
    await photo.GET(new Request('http://x'), params(['c 1', 'x.png']));
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/uploads/photo/c%201/x.png');
  });

  it('met la photo en cache longue durée — la clé porte un UUID', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(200, { 'content-type': 'image/png' }));
    const r = await photo.GET(new Request('http://x'), params(['c1', 'x.png']));
    expect(r.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect(r.headers.get('content-type')).toBe('image/png');
  });

  it('relaie un 404 sans exposer d’URL de stockage', async () => {
    vi.mocked(fetch).mockResolvedValue(amont(404, {}, ''));
    const r = await photo.GET(new Request('http://x'), params(['c1', 'x.png']));
    expect(r.status).toBe(404);
    await expect(r.text()).resolves.toBe('Photo introuvable');
  });
});

describe('GET /api/categories/[id]/attributes', () => {
  const params = { params: Promise.resolve({ id: 'c1' }) };

  it('rend les attributs de la catégorie', async () => {
    apiFetch.mockResolvedValue([{ id: 'a1', name: 'Couleur' }]);
    const r = await attributs.GET(new Request('http://x'), params);
    await expect(r.json()).resolves.toEqual([{ id: 'a1', name: 'Couleur' }]);
    expect(apiFetch).toHaveBeenCalledWith('/categories/c1/attributes');
  });

  it('relaie le code de refus de l’API', async () => {
    apiFetch.mockRejectedValue(new ApiError(403, 'Interdit'));
    const r = await attributs.GET(new Request('http://x'), params);
    expect(r.status).toBe(403);
    await expect(r.json()).resolves.toEqual({ message: 'Attributs indisponibles.' });
  });

  it('répond 500 sur une panne inattendue', async () => {
    apiFetch.mockRejectedValue(new Error('boum'));
    const r = await attributs.GET(new Request('http://x'), params);
    expect(r.status).toBe(500);
  });
});

describe('GET /api/products/search', () => {
  const vendable = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    reference: 'A-0042',
    status: { leavesStock: false },
    ...over,
  });

  it('rend les articles trouvés', async () => {
    apiFetch.mockResolvedValue({ products: [vendable()] });
    const r = await recherche.GET(new Request('http://x/api/products/search?q=A-0042'));
    await expect(r.json()).resolves.toEqual([vendable()]);
    expect(String(apiFetch.mock.calls[0][0])).toContain('search=A-0042');
  });

  it('écarte ce qui est déjà sorti du stock — vendu, rendu, retiré', async () => {
    apiFetch.mockResolvedValue({
      products: [vendable(), vendable({ id: 'p2', status: { leavesStock: true } })],
    });
    const r = await recherche.GET(new Request('http://x/api/products/search?q=veste'));
    await expect(r.json()).resolves.toHaveLength(1);
  });

  it('ne cherche rien sur une saisie vide', async () => {
    const r = await recherche.GET(new Request('http://x/api/products/search?q=%20'));
    await expect(r.json()).resolves.toEqual([]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('restreint à la boutique quand elle est donnée', async () => {
    apiFetch.mockResolvedValue({ products: [] });
    await recherche.GET(new Request('http://x/api/products/search?q=veste&shopId=b1'));
    expect(String(apiFetch.mock.calls[0][0])).toContain('shopId=b1');
  });

  it('restreint aux articles annoncés pour la vente en ligne', async () => {
    // Le filtre doit être **relayé** : oublier de le transmettre proposait
    // tout le stock au comptoir en ligne, sans erreur visible.
    apiFetch.mockResolvedValue({ products: [] });
    await recherche.GET(new Request('http://x/api/products/search?q=veste&isOnline=true'));
    expect(String(apiFetch.mock.calls[0][0])).toContain('isOnline=true');
  });

  it('ne restreint pas quand le canal n’est pas en ligne', async () => {
    apiFetch.mockResolvedValue({ products: [] });
    await recherche.GET(new Request('http://x/api/products/search?q=veste'));
    expect(String(apiFetch.mock.calls[0][0])).not.toContain('isOnline');
  });

  it('relaie le code de refus de l’API', async () => {
    apiFetch.mockRejectedValue(new ApiError(403, 'Interdit'));
    const r = await recherche.GET(new Request('http://x/api/products/search?q=veste'));
    expect(r.status).toBe(403);
  });
});
