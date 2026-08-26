'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

/**
 * Marque une notification comme lue, ou toutes si aucun identifiant n'est
 * fourni. Signature d'action de formulaire simple — pas de useActionState ici,
 * le résultat se lit dans le badge du layout, rafraîchi juste après.
 */
export async function marquerLue(data: FormData): Promise<void> {
  const id = String(data.get('id') ?? '');
  await apiFetch(id ? `/notifications/${id}/read` : '/notifications/read-all', { method: 'PUT' });
  revalidatePath('/dashboard', 'layout');
}
