'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export interface CategoryState {
  error?: string;
  success?: string;
}

function message(error: unknown, fallback: string): CategoryState {
  return { error: error instanceof ApiError ? error.message : fallback };
}

export async function createCategory(
  _state: CategoryState,
  data: FormData,
): Promise<CategoryState> {
  const name = String(data.get('name') ?? '').trim();
  if (!name) return { error: 'Le nom est obligatoire.' };
  const parentId = String(data.get('parentId') ?? '');

  try {
    await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, parentId: parentId || null }),
    });
  } catch (error) {
    return message(error, 'Création impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { success: `Catégorie « ${name} » créée.` };
}

export async function updateCategory(
  _state: CategoryState,
  data: FormData,
): Promise<CategoryState> {
  const id = String(data.get('id'));
  const parentId = String(data.get('parentId') ?? '');

  try {
    await apiFetch(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: String(data.get('name') ?? '').trim(),
        parentId: parentId || null,
      }),
    });
  } catch (error) {
    return message(error, 'Modification impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { success: 'Catégorie mise à jour.' };
}

export async function deleteCategory(
  _state: CategoryState,
  data: FormData,
): Promise<CategoryState> {
  try {
    await apiFetch(`/categories/${String(data.get('id'))}`, { method: 'DELETE' });
  } catch (error) {
    return message(error, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { success: 'Catégorie supprimée.' };
}

/**
 * Configure les attributs proposés pour une catégorie.
 *
 * C'est le sens naturel de lecture du catalogue — « une robe a une taille et
 * une couleur » — et non l'inverse. La table est la même que côté attribut,
 * seule la direction de l'écran change.
 */
export async function setAttributes(_state: CategoryState, data: FormData): Promise<CategoryState> {
  try {
    await apiFetch(`/categories/${String(data.get('id'))}/attributes`, {
      method: 'PUT',
      body: JSON.stringify({
        attributeDefinitionIds: data.getAll('attributeId').map(String),
      }),
    });
  } catch (error) {
    return message(error, 'Enregistrement impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { success: 'Attributs enregistrés.' };
}
