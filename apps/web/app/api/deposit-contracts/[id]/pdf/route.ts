import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie le PDF du contrat de dépôt.
 *
 * Même raison que l'export CSV : un lien de téléchargement ne peut pas porter
 * d'en-tête Authorization, et le jeton vit dans un cookie httpOnly. Le fichier
 * transite donc par le serveur Next, qui rattache l'authentification — et le
 * nom de fichier proposé par l'API est recopié tel quel, c'est lui qui range
 * les contrats dans le dossier de téléchargement du gérant.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return new Response('Non authentifié', { status: 401 });

  const response = await fetch(`${API_URL}/deposit-contracts/${encodeURIComponent(id)}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok || !response.body) {
    return new Response('Contrat indisponible.', { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition':
        response.headers.get('content-disposition') ?? 'attachment; filename="contrat.pdf"',
    },
  });
}
