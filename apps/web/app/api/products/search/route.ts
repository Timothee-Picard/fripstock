import { apiFetch, ApiError } from '@/lib/api';
import type { ProductPage } from '@/lib/types';

/**
 * Recherche d'articles vendables, pour le comptoir du tableau de bord.
 *
 * Passe par le serveur Next : le navigateur n'a pas le jeton, il est dans un
 * cookie httpOnly. Les articles déjà sortis du stock — vendus, rendus,
 * retirés — sont écartés ici : les proposer au comptoir n'aurait pas de sens.
 *
 * Le vivier dépend de l'endroit d'où l'on vend : une boutique pour le comptoir,
 * les articles annoncés pour la vente en ligne. Un article jamais publié n'a
 * pas pu se vendre sur le site.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q === '') return Response.json([]);

  const params = new URLSearchParams({ search: q, perPage: '20' });
  const shopId = url.searchParams.get('shopId');
  if (shopId) params.set('shopId', shopId);
  if (url.searchParams.get('isOnline') === 'true') params.set('isOnline', 'true');

  try {
    const page = await apiFetch<ProductPage>(`/products?${params.toString()}`);
    return Response.json(page.products.filter((p) => !p.status.leavesStock));
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return Response.json({ message: 'Recherche indisponible.' }, { status });
  }
}
