import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie une photo produit depuis l'API.
 *
 * Le bucket MinIO n'est pas public : une balise <img> ne peut pas porter
 * d'en-tête Authorization, donc le navigateur passe par cette route, qui lit le
 * cookie httpOnly et rattache le jeton côté serveur. Aucune URL de stockage
 * n'est exposée, et une photo reste inaccessible sans session.
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return new Response('Non authentifié', { status: 401 });

  const response = await fetch(
    `${API_URL}/uploads/photo/${key.map(encodeURIComponent).join('/')}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!response.ok || !response.body) {
    return new Response('Photo introuvable', { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
