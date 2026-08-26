'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export interface AttributeState {
  error?: string;
  success?: string;
}

function message(error: unknown, fallback: string): AttributeState {
  return { error: error instanceof ApiError ? error.message : fallback };
}

/** Découpe une saisie « S, M, L » ou une option par ligne. */
function decouperOptions(brut: string): { value: string }[] {
  return brut
    .split(/[\n,;]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((value) => ({ value }));
}

export async function cloneTemplate(
  _state: AttributeState,
  data: FormData,
): Promise<AttributeState> {
  try {
    await apiFetch(`/attributes/from-template/${String(data.get('templateId'))}`, {
      method: 'POST',
    });
  } catch (error) {
    return message(error, 'Clonage impossible.');
  }
  revalidatePath('/dashboard/attributes');
  return { success: `« ${String(data.get('name'))} » ajouté depuis le modèle.` };
}

export async function createAttribute(
  _state: AttributeState,
  data: FormData,
): Promise<AttributeState> {
  const name = String(data.get('name') ?? '').trim();
  const type = String(data.get('type') ?? '');
  const options = decouperOptions(String(data.get('options') ?? ''));

  if (!name) return { error: 'Le nom est obligatoire.' };
  if ((type === 'SELECT' || type === 'MULTISELECT') && options.length === 0) {
    return { error: 'Ce type a besoin d’au moins une option.' };
  }

  try {
    await apiFetch('/attributes', {
      method: 'POST',
      body: JSON.stringify({ name, type, options }),
    });
  } catch (error) {
    return message(error, 'Création impossible.');
  }
  revalidatePath('/dashboard/attributes');
  return { success: `Attribut « ${name} » créé.` };
}

export async function renameAttribute(
  _state: AttributeState,
  data: FormData,
): Promise<AttributeState> {
  try {
    await apiFetch(`/attributes/${String(data.get('id'))}`, {
      method: 'PUT',
      body: JSON.stringify({ name: String(data.get('name') ?? '').trim() }),
    });
  } catch (error) {
    return message(error, 'Renommage impossible.');
  }
  revalidatePath('/dashboard/attributes');
  return { success: 'Attribut renommé.' };
}

/**
 * Envoie la liste complète et ordonnée : l'API crée les nouvelles valeurs,
 * renomme celles qui ont un id, et supprime les absentes.
 */
export async function setOptions(_state: AttributeState, data: FormData): Promise<AttributeState> {
  const options = decouperOptions(String(data.get('options') ?? ''));
  if (options.length === 0) return { error: 'Il faut conserver au moins une option.' };

  try {
    await apiFetch(`/attributes/${String(data.get('id'))}/options`, {
      method: 'PUT',
      body: JSON.stringify({ options }),
    });
  } catch (error) {
    return message(error, 'Enregistrement impossible.');
  }
  revalidatePath('/dashboard/attributes');
  return { success: 'Options enregistrées.' };
}

export async function deleteAttribute(
  _state: AttributeState,
  data: FormData,
): Promise<AttributeState> {
  try {
    await apiFetch(`/attributes/${String(data.get('id'))}`, { method: 'DELETE' });
  } catch (error) {
    return message(error, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/attributes');
  return { success: 'Attribut supprimé.' };
}
