'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { cellNumber, readFormLines } from '@/lib/form-lines';

export interface ContractState {
  error?: string;
  success?: string;
}

function message(error: unknown, fallback: string): ContractState {
  return { error: error instanceof ApiError ? error.message : fallback };
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

/** Un article du tableau, au format attendu par l'API. */
interface ContractLine {
  name: string;
  categoryId: string;
  shopId: string | null;
  reference?: string;
  description?: string;
  internalNote?: string;
  photoUrl?: string;
  salePrice?: number;
  quantity?: number;
  attributes?: { attributeDefinitionId: string; value: string | string[] }[];
}

/**
 * Articles saisis dans le tableau du formulaire de contrat.
 *
 * Une ligne sans nom est ignorée : le tableau garde toujours une ligne vide en
 * bas pour la saisie suivante, elle ne doit pas partir à l'API.
 */
function readLines(data: FormData): ContractLine[] {
  const shopId = String(data.get('shopId') ?? '').trim() || null;
  return readFormLines(data)
    .map(({ cells, attributes }): ContractLine | null => {
      if (!cells.name) return null;
      return {
        name: cells.name,
        categoryId: cells.categoryId ?? '',
        shopId,
        reference: cells.reference,
        description: cells.description,
        internalNote: cells.internalNote,
        photoUrl: cells.photoUrl,
        salePrice: cellNumber(cells.salePrice),
        quantity: cellNumber(cells.quantity),
        ...(attributes.length > 0 ? { attributes } : {}),
      };
    })
    .filter((line): line is ContractLine => line !== null);
}

export async function createContract(
  _state: ContractState,
  data: FormData,
): Promise<ContractState> {
  const products = readLines(data);
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
        // Contrat et articles partent ensemble : l'API les écrit dans la même
        // transaction, une ligne refusée n'enregistre rien.
        ...(products.length > 0 ? { products } : {}),
      }),
    });
    id = created.id;
  } catch (error) {
    return message(error, 'Création impossible.');
  }
  refresh();
  if (products.length > 0) revalidatePath('/dashboard/products', 'layout');
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
export async function runDeadlines(): Promise<ContractState> {
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
