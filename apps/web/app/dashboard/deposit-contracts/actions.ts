'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

export interface ContractState {
  error?: string;
  success?: string;
}

function message(error: unknown, defaut: string): ContractState {
  return { error: error instanceof ApiError ? error.message : defaut };
}

function refresh(id?: string) {
  revalidatePath('/dashboard/deposit-contracts');
  if (id) revalidatePath(`/dashboard/deposit-contracts/${id}`);
  revalidatePath('/dashboard/depositors', 'layout');
}

/** `2026-08-26` (input date) → ISO complet attendu par l'API. */
function day(data: FormData, key: string): string | undefined {
  const brut = String(data.get(key) ?? '').trim();
  return brut ? new Date(`${brut}T00:00:00Z`).toISOString() : undefined;
}

function count(data: FormData, key: string): number | undefined {
  const brut = String(data.get(key) ?? '')
    .trim()
    .replace(',', '.');
  if (brut === '') return undefined;
  const n = Number(brut);
  return Number.isNaN(n) ? undefined : n;
}

export async function createContract(
  _state: ContractState,
  data: FormData,
): Promise<ContractState> {
  let id: string;
  try {
    const created = await apiFetch<{ id: string }>('/deposit-contracts', {
      method: 'POST',
      body: JSON.stringify({
        depositorId: String(data.get('depositorId') ?? ''),
        startDate: day(data, 'startDate'),
        endDate: day(data, 'endDate'),
        commission: count(data, 'commission'),
        notifyBeforeDays: count(data, 'notifyBeforeDays'),
      }),
    });
    id = created.id;
  } catch (error) {
    return message(error, 'Création impossible.');
  }
  refresh();
  redirect(`/dashboard/deposit-contracts/${id}`);
}

export async function updateContract(
  _state: ContractState,
  data: FormData,
): Promise<ContractState> {
  const id = String(data.get('id'));
  try {
    await apiFetch(`/deposit-contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        startDate: day(data, 'startDate'),
        endDate: day(data, 'endDate'),
        commission: count(data, 'commission'),
        notifyBeforeDays: count(data, 'notifyBeforeDays'),
        ...(data.get('status') ? { status: String(data.get('status')) } : {}),
      }),
    });
  } catch (error) {
    return message(error, 'Modification impossible.');
  }
  refresh(id);
  return { success: 'Contrat mis à jour.' };
}

export async function attachProducts(
  _state: ContractState,
  data: FormData,
): Promise<ContractState> {
  const id = String(data.get('id'));
  const productIds = data.getAll('productId').map(String);
  if (productIds.length === 0) return { error: 'Choisissez au moins un produit.' };

  try {
    await apiFetch(`/deposit-contracts/${id}/products`, {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    });
  } catch (error) {
    return message(error, 'Rattachement impossible.');
  }
  refresh(id);
  revalidatePath('/dashboard/products', 'layout');
  return { success: `${productIds.length} produit(s) rattaché(s).` };
}

export async function detachProduct(_state: ContractState, data: FormData): Promise<ContractState> {
  const id = String(data.get('id'));
  try {
    await apiFetch(`/deposit-contracts/${id}/products/${String(data.get('productId'))}`, {
      method: 'DELETE',
    });
  } catch (error) {
    return message(error, 'Détachement impossible.');
  }
  refresh(id);
  revalidatePath('/dashboard/products', 'layout');
  return { success: 'Produit détaché.' };
}

export async function deleteContract(
  _state: ContractState,
  data: FormData,
): Promise<ContractState> {
  try {
    await apiFetch(`/deposit-contracts/${String(data.get('id'))}`, { method: 'DELETE' });
  } catch (error) {
    return message(error, 'Suppression impossible.');
  }
  refresh();
  redirect('/dashboard/deposit-contracts');
}

/** Lance la passe d'échéances à la main, sans attendre le lendemain. */
export async function lancerEcheances(): Promise<ContractState> {
  try {
    const r = await apiFetch<{ notified: number; expired: number }>(
      '/deposit-contracts/deadlines',
      {
        method: 'POST',
      },
    );
    refresh();
    revalidatePath('/dashboard', 'layout');
    return {
      success: `${r.notified} alerte(s) créée(s), ${r.expired} contrat(s) passé(s) en expiré.`,
    };
  } catch (error) {
    return message(error, 'Vérification impossible.');
  }
}
