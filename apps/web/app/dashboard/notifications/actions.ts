'use server';

import { revalidatePath } from 'next/cache';
import { appelApi } from '@/lib/api';

/**
 * Marque une notification comme lue, ou toutes si aucun identifiant n'est
 * fourni. Signature d'action de formulaire simple — pas de useActionState ici,
 * le résultat se lit dans le badge du layout, rafraîchi juste après.
 */
export async function marquerLue(donnees: FormData): Promise<void> {
  const id = String(donnees.get('id') ?? '');
  await appelApi(id ? `/notifications/${id}/lu` : '/notifications/tout-lu', { method: 'PUT' });
  revalidatePath('/dashboard', 'layout');
}
