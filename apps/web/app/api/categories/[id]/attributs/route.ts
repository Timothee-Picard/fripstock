import { appelApi, ErreurApi } from '@/lib/api';
import type { AttributDefinition } from '@/lib/types';

/**
 * Relais pour le formulaire produit, qui charge les attributs d'une catégorie
 * après le rendu initial. Le navigateur n'a pas le jeton — il est dans un
 * cookie httpOnly — donc l'appel passe par le serveur Next.
 */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const attributs = await appelApi<AttributDefinition[]>(`/categories/${id}/attributs`);
    return Response.json(attributs);
  } catch (erreur) {
    const statut = erreur instanceof ErreurApi ? erreur.statut : 500;
    return Response.json({ message: 'Attributs indisponibles.' }, { status: statut });
  }
}
