import { cookies } from 'next/headers';
import { NOM_COOKIE } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie l'envoi d'une photo vers l'API.
 *
 * Le navigateur ne peut pas rattacher le jeton lui-même (cookie httpOnly) et ne
 * doit pas parler à l'API directement : le multipart transite donc par ici.
 */
export async function POST(requete: Request) {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;
  if (!jeton) return Response.json({ message: 'Non authentifié.' }, { status: 401 });

  const reponse = await fetch(`${API_URL}/uploads/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: await requete.formData(),
  });

  const donnees: unknown = await reponse.json().catch(() => null);
  return Response.json(donnees ?? { message: 'Envoi impossible.' }, { status: reponse.status });
}
