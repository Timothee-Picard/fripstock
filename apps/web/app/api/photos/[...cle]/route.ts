import { cookies } from 'next/headers';
import { NOM_COOKIE } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie une photo produit depuis l'API.
 *
 * Le bucket MinIO n'est pas public : une balise <img> ne peut pas porter
 * d'en-tête Authorization, donc le navigateur passe par cette route, qui lit le
 * cookie httpOnly et rattache le jeton côté serveur. Aucune URL de stockage
 * n'est exposée, et une photo reste inaccessible sans session.
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ cle: string[] }> }) {
  const { cle } = await params;
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;
  if (!jeton) return new Response('Non authentifié', { status: 401 });

  const reponse = await fetch(`${API_URL}/uploads/photo/${cle.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${jeton}` },
    cache: 'no-store',
  });

  if (!reponse.ok || !reponse.body) {
    return new Response('Photo introuvable', { status: reponse.status });
  }

  return new Response(reponse.body, {
    headers: {
      'Content-Type': reponse.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
