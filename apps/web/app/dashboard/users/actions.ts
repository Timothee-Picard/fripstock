'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import { PERMISSIONS, type Permission } from '@/lib/types';

export interface UserState {
  error?: string;
  success?: string;
  temporaryPassword?: string;
}

export async function inviterEmploye(_state: UserState, data: FormData): Promise<UserState> {
  try {
    const created = await apiFetch<{
      temporaryPassword?: string;
      firstName: string;
      lastName: string;
    }>('/users/invite', {
      method: 'POST',
      body: JSON.stringify({
        email: String(data.get('email') ?? '').trim(),
        firstName: String(data.get('firstName') ?? '').trim(),
        name: String(data.get('name') ?? '').trim(),
      }),
    });
    revalidatePath('/dashboard/users');
    return {
      success: `${created.firstName} ${created.lastName} a été invité.`,
      temporaryPassword: created.temporaryPassword,
    };
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Invitation impossible.' };
  }
}

/**
 * Les cases cochées arrivent sous la forme `perm:<boutiqueId>:<permission>`.
 * On reconstruit la liste complète des accès, parce que l'API remplace
 * intégralement ceux de l'employé.
 */
export async function enregistrerAcces(_state: UserState, data: FormData): Promise<UserState> {
  const userId = String(data.get('userId') ?? '');
  const shopIds = data.getAll('shopId').map(String);

  const accesses = shopIds
    .map((shopId) => ({
      shopId,
      permissions: PERMISSIONS.filter((p) => data.has(`perm:${shopId}:${p}`)) as Permission[],
    }))
    // Une boutique sans aucune permission n'est pas un accès : on la retire.
    .filter((a) => a.permissions.length > 0);

  try {
    await apiFetch(`/users/${userId}/access`, {
      method: 'PUT',
      body: JSON.stringify({ accesses }),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Enregistrement impossible.' };
  }

  revalidatePath('/dashboard/users');
  return { success: 'Permissions enregistrées.' };
}

export async function deleteEmployee(_state: UserState, data: FormData): Promise<UserState> {
  try {
    await apiFetch(`/users/${String(data.get('userId'))}`, { method: 'DELETE' });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Suppression impossible.' };
  }
  revalidatePath('/dashboard/users');
  return { success: 'Employé supprimé.' };
}
