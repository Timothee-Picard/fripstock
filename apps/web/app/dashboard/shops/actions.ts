'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export interface ShopState {
  error?: string;
  success?: string;
}

export async function createShop(_state: ShopState, data: FormData): Promise<ShopState> {
  const name = String(data.get('name') ?? '').trim();
  if (!name) return { error: 'Le nom est obligatoire.' };

  try {
    await apiFetch('/shops', {
      method: 'POST',
      body: JSON.stringify({
        name,
        address: String(data.get('address') ?? '').trim() || undefined,
      }),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Création impossible.' };
  }

  revalidatePath('/dashboard/shops');
  return { success: `Boutique « ${name} » créée.` };
}

export async function updateShop(_state: ShopState, data: FormData): Promise<ShopState> {
  const name = String(data.get('name') ?? '').trim();
  if (!name) return { error: 'Le nom est obligatoire.' };

  try {
    await apiFetch(`/shops/${String(data.get('id'))}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        address: String(data.get('address') ?? '').trim(),
      }),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Modification impossible.' };
  }

  revalidatePath('/dashboard/shops');
  // Le nom de la boutique s'affiche aussi dans le sélecteur du layout et sur
  // les fiches produit.
  revalidatePath('/dashboard', 'layout');
  return { success: 'Boutique mise à jour.' };
}

export async function deleteShop(_state: ShopState, data: FormData): Promise<ShopState> {
  try {
    await apiFetch(`/shops/${String(data.get('id'))}`, { method: 'DELETE' });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Suppression impossible.' };
  }
  revalidatePath('/dashboard/shops');
  return { success: 'Boutique supprimée.' };
}
