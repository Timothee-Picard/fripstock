'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';

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

/** Nombre lu dans une cellule du tableau, virgule décimale comprise. */
function cellNumber(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (raw === '') return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

function cellText(value: FormDataEntryValue | null): string | undefined {
  const raw = String(value ?? '').trim();
  return raw === '' ? undefined : raw;
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
 * Chaque cellule porte un nom `line:<id>:<champ>`, et l'ordre des lignes vient
 * des `lineId` postés par le tableau — l'identifiant est propre au formulaire,
 * il ne sert qu'à regrouper les cellules d'une même ligne.
 *
 * Une ligne sans nom est ignorée : le tableau garde toujours une ligne vide en
 * bas pour la saisie suivante, elle ne doit pas partir à l'API.
 */
function readLines(data: FormData): ContractLine[] {
  return data
    .getAll('lineId')
    .map(String)
    .map((id): ContractLine | null => {
      const cell = (field: string) => data.get(`line:${id}:${field}`);
      const name = cellText(cell('name'));
      if (!name) return null;

      // `keys()` répète une clé autant de fois qu'elle porte de valeurs : sans
      // le dédoublonnage, un attribut multiselect partirait en double.
      const attributes = [...new Set(data.keys())]
        .filter((key) => key.startsWith(`line:${id}:attr:`))
        .map((key) => ({
          attributeDefinitionId: key.slice(`line:${id}:attr:`.length),
          values: data.getAll(key).map(String).filter(Boolean),
        }))
        .filter((a) => a.values.length > 0)
        .map((a) => ({
          attributeDefinitionId: a.attributeDefinitionId,
          // Une case cochée seule et un multiselect à une valeur sont
          // indiscernables ici : l'API normalise selon le type réel.
          value: a.values.length === 1 ? a.values[0] : a.values,
        }));

      return {
        name,
        categoryId: String(cell('categoryId') ?? ''),
        shopId: cellText(data.get('shopId')) ?? null,
        reference: cellText(cell('reference')),
        description: cellText(cell('description')),
        internalNote: cellText(cell('internalNote')),
        photoUrl: cellText(cell('photoUrl')),
        salePrice: cellNumber(cell('salePrice')),
        quantity: cellNumber(cell('quantity')),
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
