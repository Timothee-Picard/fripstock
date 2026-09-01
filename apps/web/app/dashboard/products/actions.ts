'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { cellNumber, usableLines } from '@/lib/form-lines';

export interface ProductState {
  error?: string;
  success?: string;
  /**
   * Marqueur unique par succès. Il permet à un formulaire de savoir qu'une
   * nouvelle réussite est arrivée — le libellé de succès, lui, est identique
   * d'une fois sur l'autre — et donc de dériver sa remise à zéro plutôt que de
   * la poser dans un effet.
   */
  token?: string;
}

function message(error: unknown, fallback: string): ProductState {
  return { error: error instanceof ApiError ? error.message : fallback };
}

/** Les valeurs d'attributs arrivent sous la forme `attr:<id>`. */
function readAttributes(data: FormData): { attributeDefinitionId: string; value: unknown }[] {
  const result: { attributeDefinitionId: string; value: unknown }[] = [];
  const multiples = new Map<string, string[]>();

  for (const [key, brut] of data.entries()) {
    if (!key.startsWith('attr:')) continue;
    const id = key.slice(5);
    const value = String(brut);
    if (value === '') continue;

    if (multiples.has(id)) {
      multiples.get(id)!.push(value);
    } else {
      multiples.set(id, [value]);
    }
  }

  for (const [attributeDefinitionId, values] of multiples) {
    // Une case cochée seule et un multiselect à une valeur sont indiscernables
    // ici : l'API accepte les deux formes et normalise selon le type réel.
    result.push({ attributeDefinitionId, value: values.length === 1 ? values[0] : values });
  }
  return result;
}

function numberOrNothing(data: FormData, field: string): number | undefined {
  const brut = String(data.get(field) ?? '').trim();
  if (brut === '') return undefined;
  const n = Number(brut.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}

export async function createProduct(_state: ProductState, data: FormData): Promise<ProductState> {
  const shopId = String(data.get('shopId') ?? '');
  let id: string;

  try {
    const created = await apiFetch<{ id: string }>('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: String(data.get('name') ?? '').trim(),
        categoryId: String(data.get('categoryId') ?? ''),
        saleType: String(data.get('saleType') ?? 'RESALE'),
        shopId: shopId || null,
        reference: String(data.get('reference') ?? '').trim() || undefined,
        description: String(data.get('description') ?? '').trim() || undefined,
        internalNote: String(data.get('internalNote') ?? '').trim() || undefined,
        photoUrl: String(data.get('photoUrl') ?? '').trim() || undefined,
        purchasePrice: numberOrNothing(data, 'purchasePrice'),
        salePrice: numberOrNothing(data, 'salePrice'),
        quantity: numberOrNothing(data, 'quantity'),
        attributes: readAttributes(data),
      }),
    });
    id = created.id;
  } catch (error) {
    return message(error, 'Création impossible.');
  }

  revalidatePath('/dashboard/products');
  // Hors du try : redirect() lève une exception de contrôle que le catch
  // présenterait comme une erreur de création.
  redirect(`/dashboard/products/${id}`);
}

/**
 * Achat en lot : un prix payé, plusieurs articles.
 *
 * Seul le prix du lot part à l'API — c'est elle qui le répartit entre les
 * articles, au prorata de leur prix de vente. L'écran en montre l'aperçu, mais
 * la règle ne doit exister qu'à un seul endroit.
 */
export async function createLot(_state: ProductState, data: FormData): Promise<ProductState> {
  const saisie = usableLines(data);
  if (saisie.error) return { error: saisie.error };

  const lines = saisie.lines.map(({ cells, attributes }) => ({
    name: cells.name,
    categoryId: cells.categoryId ?? '',
    reference: cells.reference,
    description: cells.description,
    internalNote: cells.internalNote,
    photoUrl: cells.photoUrl,
    salePrice: cellNumber(cells.salePrice),
    count: cellNumber(cells.count),
    ...(attributes.length > 0 ? { attributes } : {}),
  }));

  if (lines.length === 0) return { error: 'Ajoutez au moins un article au lot.' };

  let created: { count: number };
  try {
    created = await apiFetch<{ count: number }>('/products/lot', {
      method: 'POST',
      body: JSON.stringify({
        totalPurchasePrice: numberOrNothing(data, 'totalPurchasePrice') ?? 0,
        shopId: String(data.get('shopId') ?? '').trim() || undefined,
        lines,
      }),
    });
  } catch (error) {
    return message(error, 'Création du lot impossible.');
  }

  revalidatePath('/dashboard/products');
  redirect(`/dashboard/products?lot=${created.count}`);
}

/**
 * Vente au comptoir : le panier part d'un coup.
 *
 * Les prix arrivent déjà répartis — la remise est une affaire d'affichage, ce
 * qui compte en base est ce que chaque article a réellement rapporté.
 */
export async function sellBasket(
  _state: ProductState,
  data: FormData,
): Promise<ProductState & { sold?: number }> {
  const lines = data
    .getAll('line')
    .map(String)
    .map((brut) => {
      const [productId, prix] = brut.split(':');
      return { productId, soldPrice: Number(prix) };
    })
    .filter((l) => l.productId && Number.isFinite(l.soldPrice));

  if (lines.length === 0) return { error: 'Ajoutez au moins un article.' };

  // Statut visé, pour une vente en ligne. Absent, l'API prend le statut de
  // vente au comptoir — celui qui porte `isSale` sans `isOnlineSale`.
  const statusId = String(data.get('statusId') ?? '');

  let vendu: { count: number; total: number };
  try {
    vendu = await apiFetch<{ count: number; total: number }>('/products/sale', {
      method: 'POST',
      body: JSON.stringify({ lines, ...(statusId ? { statusId } : {}) }),
    });
  } catch (error) {
    return message(error, 'Vente impossible.');
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/products', 'layout');
  revalidatePath('/dashboard/depositors', 'layout');
  return {
    success: `${vendu.count} article${vendu.count > 1 ? 's' : ''} vendu${vendu.count > 1 ? 's' : ''} · ${vendu.total.toFixed(2).replace('.', ',')} €`,
    sold: vendu.count,
    token: randomUUID(),
  };
}

export async function changeStatus(_state: ProductState, data: FormData): Promise<ProductState> {
  const id = String(data.get('id'));
  const soldPrice = numberOrNothing(data, 'soldPrice');

  try {
    await apiFetch(`/products/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        statusId: String(data.get('statusId')),
        ...(soldPrice !== undefined ? { soldPrice } : {}),
        ...(String(data.get('note') ?? '').trim() ? { note: String(data.get('note')).trim() } : {}),
      }),
    });
  } catch (error) {
    return message(error, 'Changement de statut impossible.');
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  return { success: 'Statut mis à jour.', token: randomUUID() };
}

export async function assignShop(_state: ProductState, data: FormData): Promise<ProductState> {
  const id = String(data.get('id'));
  const shopId = String(data.get('shopId') ?? '');

  try {
    await apiFetch(`/products/${id}/assign-shop`, {
      method: 'PUT',
      body: JSON.stringify({ shopId: shopId || null }),
    });
  } catch (error) {
    return message(error, 'Assignation impossible.');
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  return { success: 'Boutique mise à jour.' };
}

export async function deleteProduct(_state: ProductState, data: FormData): Promise<ProductState> {
  try {
    await apiFetch(`/products/${String(data.get('id'))}`, { method: 'DELETE' });
  } catch (error) {
    return message(error, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/products');
  redirect('/dashboard/products');
}

/**
 * Modification d'un produit existant.
 *
 * Les attributs sont renvoyés en entier : l'API les revalide contre la
 * catégorie finale, qui a pu changer et rendre certains inapplicables.
 */
export async function updateProduct(_state: ProductState, data: FormData): Promise<ProductState> {
  const id = String(data.get('id'));
  const shopId = String(data.get('shopId') ?? '');
  const saleType = String(data.get('saleType') ?? 'RESALE');

  try {
    await apiFetch(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: String(data.get('name') ?? '').trim(),
        categoryId: String(data.get('categoryId') ?? ''),
        saleType,
        shopId: shopId || null,
        reference: String(data.get('reference') ?? '').trim(),
        description: String(data.get('description') ?? '').trim(),
        internalNote: String(data.get('internalNote') ?? '').trim(),
        photoUrl: String(data.get('photoUrl') ?? '').trim(),
        purchasePrice: saleType === 'RESALE' ? numberOrNothing(data, 'purchasePrice') : undefined,
        salePrice: numberOrNothing(data, 'salePrice'),
        quantity: numberOrNothing(data, 'quantity'),
        attributes: readAttributes(data),
      }),
    });
  } catch (error) {
    return message(error, 'Modification impossible.');
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  redirect(`/dashboard/products/${id}`);
}

/**
 * Corrige une vente déjà enregistrée : prix encaissé, date, commission.
 *
 * Distinct du changement de statut, qui trace l'historique : ici on rectifie
 * une saisie, on ne fait pas franchir une étape au produit.
 */
export async function updateSale(_state: ProductState, data: FormData): Promise<ProductState> {
  const id = String(data.get('id'));
  const commission = numberOrNothing(data, 'appliedCommission');

  try {
    await apiFetch(`/products/${id}/sale`, {
      method: 'PUT',
      body: JSON.stringify({
        soldPrice: numberOrNothing(data, 'soldPrice'),
        soldAt: String(data.get('soldAt') ?? '')
          ? new Date(String(data.get('soldAt'))).toISOString()
          : undefined,
        ...(commission !== undefined ? { appliedCommission: commission } : {}),
      }),
    });
  } catch (error) {
    return message(error, 'Correction impossible.');
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  return { success: 'Vente corrigée.', token: randomUUID() };
}

/**
 * Publie l'article sur le site, ou l'en retire, et fixe son prix en ligne.
 *
 * Route à part de la modification du produit : le droit « Gérer la vente en
 * ligne » suffit ici, alors que corriger le vêtement demande « Créer et
 * modifier des produits ».
 */
export async function setOnline(_state: ProductState, data: FormData): Promise<ProductState> {
  const id = String(data.get('id'));
  const isOnline = data.get('isOnline') === 'true';
  const brut = String(data.get('onlinePrice') ?? '').trim();

  try {
    await apiFetch(`/products/${id}/online`, {
      method: 'PUT',
      body: JSON.stringify({
        isOnline,
        // Vide efface le prix : le site retombe alors sur le prix boutique,
        // plutôt que d'obliger à saisir deux fois le même montant.
        onlinePrice: brut === '' ? null : Number(brut.replace(',', '.')),
      }),
    });
  } catch (error) {
    return message(error, 'Mise en ligne impossible.');
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  return {
    success: isOnline ? 'Article en ligne.' : 'Article retiré du site.',
    token: randomUUID(),
  };
}

/** « Retrait effectué » : l'article vendu a été ôté de l'autre canal. */
export async function markRemovalDone(_state: ProductState, data: FormData): Promise<ProductState> {
  const id = String(data.get('id'));
  try {
    await apiFetch(`/products/${id}/removal-done`, { method: 'PUT' });
  } catch (error) {
    return message(error, 'Enregistrement impossible.');
  }
  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  return { success: 'Retrait enregistré.', token: randomUUID() };
}

/**
 * « Tout retirer » : plusieurs retraits confirmés d'un coup.
 *
 * Le geste réel est groupé — on dépublie douze annonces d'affilée, puis on
 * revient dire que c'est fait. Douze clics pour une seule action est ce qui
 * fait abandonner une liste de tâches.
 */
export async function markRemovalsDone(
  _state: ProductState,
  data: FormData,
): Promise<ProductState> {
  const productIds = data.getAll('productId').map(String).filter(Boolean);
  if (productIds.length === 0) return { error: 'Aucun article à retirer.' };

  let resultat: { count: number };
  try {
    resultat = await apiFetch<{ count: number }>('/products/removals-done', {
      method: 'PUT',
      body: JSON.stringify({ productIds }),
    });
  } catch (error) {
    return message(error, 'Enregistrement impossible.');
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/products', 'layout');
  return {
    success: `${resultat.count} retrait${resultat.count > 1 ? 's' : ''} enregistré${resultat.count > 1 ? 's' : ''}.`,
    token: randomUUID(),
  };
}

/** Marque la part du déposant comme réglée, ou revient dessus. */
export async function toggleDepositorPayment(
  _state: ProductState,
  data: FormData,
): Promise<ProductState> {
  const id = String(data.get('id'));
  try {
    await apiFetch(`/products/${id}/depositor-payment`, {
      method: 'PUT',
      body: JSON.stringify({ paid: data.get('paid') === 'true' }),
    });
  } catch (error) {
    return message(error, 'Enregistrement impossible.');
  }
  revalidatePath(`/dashboard/products/${id}`);
  // Le relevé du déposant en dépend directement.
  revalidatePath('/dashboard/depositors', 'layout');
  return { success: 'Règlement mis à jour.', token: randomUUID() };
}
