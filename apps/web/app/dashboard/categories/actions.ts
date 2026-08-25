'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatCategorie {
  erreur?: string;
  succes?: string;
}

function message(erreur: unknown, defaut: string): EtatCategorie {
  return { erreur: erreur instanceof ErreurApi ? erreur.message : defaut };
}

export async function creerCategorie(
  _etat: EtatCategorie,
  donnees: FormData,
): Promise<EtatCategorie> {
  const nom = String(donnees.get('nom') ?? '').trim();
  if (!nom) return { erreur: 'Le nom est obligatoire.' };
  const parentId = String(donnees.get('parentId') ?? '');

  try {
    await appelApi('/categories', {
      method: 'POST',
      body: JSON.stringify({ nom, parentId: parentId || null }),
    });
  } catch (erreur) {
    return message(erreur, 'Création impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { succes: `Catégorie « ${nom} » créée.` };
}

export async function modifierCategorie(
  _etat: EtatCategorie,
  donnees: FormData,
): Promise<EtatCategorie> {
  const id = String(donnees.get('id'));
  const parentId = String(donnees.get('parentId') ?? '');

  try {
    await appelApi(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nom: String(donnees.get('nom') ?? '').trim(),
        parentId: parentId || null,
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Modification impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { succes: 'Catégorie mise à jour.' };
}

export async function supprimerCategorie(
  _etat: EtatCategorie,
  donnees: FormData,
): Promise<EtatCategorie> {
  try {
    await appelApi(`/categories/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return message(erreur, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/categories');
  return { succes: 'Catégorie supprimée.' };
}
