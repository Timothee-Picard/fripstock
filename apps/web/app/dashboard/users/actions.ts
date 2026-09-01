'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import { COMPANY_PERMISSIONS, SHOP_PERMISSIONS, type Permission } from '@/lib/types';

export interface UserState {
  error?: string;
  success?: string;
  temporaryPassword?: string;
}

export async function inviteEmployee(_state: UserState, data: FormData): Promise<UserState> {
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
        lastName: String(data.get('lastName') ?? '').trim(),
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
 * Reconstruit la liste complète des accès : l'API remplace intégralement ceux
 * de l'employé.
 *
 * Deux origines de cases. Les droits de boutique arrivent en
 * `perm:<boutiqueId>:<permission>`, les **droits d'entreprise** en
 * `company:<permission>` — cochés une seule fois, puisque le catalogue, les
 * déposants et le site sont communs.
 *
 * Un droit d'entreprise est **recopié sur toutes les boutiques**. La table
 * `ShopAccess` n'a pas d'autre endroit où le poser, et c'est ce qui le rend
 * vrai partout : le garde le cherche « sur au moins une boutique », et le
 * service laisse alors son porteur travailler sur un article de n'importe
 * laquelle.
 */
export async function saveAccess(_state: UserState, data: FormData): Promise<UserState> {
  const userId = String(data.get('userId') ?? '');
  const shopIds = data.getAll('shopId').map(String);
  const entreprise = COMPANY_PERMISSIONS.filter((p) => data.has(`company:${p}`));

  const accesses = shopIds
    .map((shopId) => ({
      shopId,
      permissions: [
        ...SHOP_PERMISSIONS.filter((p) => data.has(`perm:${shopId}:${p}`)),
        ...entreprise,
      ] as Permission[],
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
