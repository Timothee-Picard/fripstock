import { apiFetch, ApiError } from '@/lib/api';
import type { AttributeDefinition } from '@/lib/types';

/**
 * Relais pour le formulaire produit, qui charge les attributs d'une catégorie
 * après le rendu initial. Le navigateur n'a pas le jeton — il est dans un
 * cookie httpOnly — donc l'appel passe par le serveur Next.
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const attributes = await apiFetch<AttributeDefinition[]>(`/categories/${id}/attributes`);
    return Response.json(attributes);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return Response.json({ message: 'Attributs indisponibles.' }, { status: status });
  }
}
