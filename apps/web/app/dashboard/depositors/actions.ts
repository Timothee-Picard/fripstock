'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

export interface DepositorState {
  error?: string;
  success?: string;
}

function message(error: unknown, defaut: string): DepositorState {
  return { error: error instanceof ApiError ? error.message : defaut };
}

/** Champs communs à la création et à la modification. */
function corps(data: FormData) {
  const text = (key: string) => String(data.get(key) ?? '').trim();
  const commission = text('defaultCommission').replace(',', '.');
  return {
    name: text('name'),
    firstName: text('firstName') || undefined,
    email: text('email') || undefined,
    phone: text('telephone') || undefined,
    address: text('adresse') || undefined,
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
  if (!String(data.get('name') ?? '').trim()) return { error: 'Le nom est obligatoire.' };
  try {
    await apiFetch('/depositors', { method: 'POST', body: JSON.stringify(corps(data)) });
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
      body: JSON.stringify(corps(data)),
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
