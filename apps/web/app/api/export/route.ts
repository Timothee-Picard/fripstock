import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie le téléchargement du CSV.
 *
 * Un lien de téléchargement ne peut pas porter d'en-tête Authorization, et le
 * jeton vit dans un cookie httpOnly : le fichier transite donc par le serveur
 * Next, qui rattache l'authentification. Les filtres de la liste sont passés
 * tels quels.
 */
export async function GET(request: Request) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return new Response('Non authentifié', { status: 401 });

  const filters = new URL(request.url).searchParams;
  const response = await fetch(`${API_URL}/products/export?${filters.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok || !response.body) {
    return new Response('Export impossible.', { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition':
        response.headers.get('content-disposition') ?? 'attachment; filename="stock.csv"',
    },
  });
}
