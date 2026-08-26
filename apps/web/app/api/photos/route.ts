import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

/**
 * Relaie l'envoi d'une photo vers l'API.
 *
 * Le navigateur ne peut pas rattacher le jeton lui-même (cookie httpOnly) et ne
 * doit pas parler à l'API directement : le multipart transite donc par ici.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Non authentifié.' }, { status: 401 });

  const response = await fetch(`${API_URL}/uploads/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: await request.formData(),
  });

  const data: unknown = await response.json().catch(() => null);
  return Response.json(data ?? { message: 'Envoi impossible.' }, { status: response.status });
}
