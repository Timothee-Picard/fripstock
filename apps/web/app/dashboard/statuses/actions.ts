'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export interface StatusState {
  error?: string;
  success?: string;
}

function message(error: unknown, defaut: string): StatusState {
  return { error: error instanceof ApiError ? error.message : defaut };
}

function refresh() {
  revalidatePath('/dashboard/statuses');
  // Les badges et les listes déroulantes de statut se trouvent aussi ailleurs.
  revalidatePath('/dashboard/products', 'layout');
}

/**
 * Renomme et recolore un statut.
 *
 * Ni création ni suppression : le flux référence les statuts, un statut ajouté
 * n'aurait aucune flèche et resterait inatteignable. Le libellé, lui, reste
 * libre — c'est précisément pour ça que le comportement tient à des flags.
 */
export async function updateStatus(_state: StatusState, data: FormData): Promise<StatusState> {
  try {
    await apiFetch(`/statuses/${String(data.get('id'))}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: String(data.get('name') ?? '').trim(),
        color: String(data.get('color') ?? '#6b7280'),
      }),
    });
  } catch (error) {
    return message(error, 'Modification impossible.');
  }
  refresh();
  return { success: 'Statut mis à jour.' };
}

export async function definirParDefaut(_state: StatusState, data: FormData): Promise<StatusState> {
  try {
    await apiFetch(`/statuses/${String(data.get('id'))}/default`, { method: 'PUT' });
  } catch (error) {
    return message(error, 'Changement impossible.');
  }
  refresh();
  return { success: 'Statut par défaut mis à jour.' };
}
