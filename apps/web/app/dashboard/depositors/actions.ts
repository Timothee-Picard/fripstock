'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

export interface DepositorState {
  error?: string;
  success?: string;
}

function message(error: unknown, fallback: string): DepositorState {
  return { error: error instanceof ApiError ? error.message : fallback };
}

/** Champs communs à la création et à la modification. */
function body(data: FormData) {
  const text = (key: string) => String(data.get(key) ?? '').trim();
  const commission = text('defaultCommission').replace(',', '.');
  return {
    lastName: text('lastName'),
    firstName: text('firstName') || undefined,
    email: text('email') || undefined,
    phone: text('phone') || undefined,
    address: text('address') || undefined,
    // Les IBAN se notent souvent avec des espaces : on les retire avant l'API,
    // qui les refuserait.
    iban: text('iban').replace(/\s+/g, '').toUpperCase() || undefined,
    defaultCommission: commission === '' ? undefined : Number(commission),
  };
}

export async function createDepositor(
  _state: DepositorState,
  data: FormData,
): Promise<DepositorState> {
  if (!String(data.get('lastName') ?? '').trim()) return { error: 'Le nom est obligatoire.' };
  try {
    await apiFetch('/depositors', { method: 'POST', body: JSON.stringify(body(data)) });
  } catch (error) {
    return message(error, 'Création impossible.');
  }
  revalidatePath('/dashboard/depositors');
  return { success: 'Déposant créé.' };
}

export async function updateDepositor(
  _state: DepositorState,
  data: FormData,
): Promise<DepositorState> {
  const id = String(data.get('id'));
  try {
    await apiFetch(`/depositors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body(data)),
    });
  } catch (error) {
    return message(error, 'Modification impossible.');
  }
  revalidatePath('/dashboard/depositors');
  revalidatePath(`/dashboard/depositors/${id}`);
  return { success: 'Déposant mis à jour.' };
}

export async function deleteDepositor(
  _state: DepositorState,
  data: FormData,
): Promise<DepositorState> {
  try {
    await apiFetch(`/depositors/${String(data.get('id'))}`, { method: 'DELETE' });
  } catch (error) {
    return message(error, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/depositors');
  redirect('/dashboard/depositors');
}
