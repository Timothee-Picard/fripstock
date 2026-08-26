import { cookies } from 'next/headers';
import { NOM_COOKIE } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie le téléchargement du CSV.
 *
 * Un lien de téléchargement ne peut pas porter d'en-tête Authorization, et le
 * jeton vit dans un cookie httpOnly : le fichier transite donc par le serveur
 * Next, qui rattache l'authentification. Les filtres de la liste sont passés
 * tels quels.
 */
export async function GET(requete: Request) {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;
  if (!jeton) return new Response('Non authentifié', { status: 401 });

  const filtres = new URL(requete.url).searchParams;
  const reponse = await fetch(`${API_URL}/produits/export?${filtres.toString()}`, {
    headers: { Authorization: `Bearer ${jeton}` },
    cache: 'no-store',
  });

  if (!reponse.ok || !reponse.body) {
    return new Response('Export impossible.', { status: reponse.status });
  }

  return new Response(reponse.body, {
    headers: {
      'Content-Type': reponse.headers.get('content-type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition':
        reponse.headers.get('content-disposition') ?? 'attachment; filename="stock.csv"',
    },
  });
}
