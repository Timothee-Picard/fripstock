'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatBoutique {
  erreur?: string;
  succes?: string;
}

export async function creerBoutique(_etat: EtatBoutique, donnees: FormData): Promise<EtatBoutique> {
  const nom = String(donnees.get('nom') ?? '').trim();
  if (!nom) return { erreur: 'Le nom est obligatoire.' };

  try {
    await appelApi('/boutiques', {
      method: 'POST',
      body: JSON.stringify({
        nom,
        adresse: String(donnees.get('adresse') ?? '').trim() || undefined,
      }),
    });
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Création impossible.' };
  }

  revalidatePath('/dashboard/boutiques');
  return { succes: `Boutique « ${nom} » créée.` };
}

export async function modifierBoutique(
  _etat: EtatBoutique,
  donnees: FormData,
): Promise<EtatBoutique> {
  const nom = String(donnees.get('nom') ?? '').trim();
  if (!nom) return { erreur: 'Le nom est obligatoire.' };

  try {
    await appelApi(`/boutiques/${String(donnees.get('id'))}`, {
      method: 'PUT',
      body: JSON.stringify({
        nom,
        adresse: String(donnees.get('adresse') ?? '').trim(),
      }),
    });
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Modification impossible.' };
  }

  revalidatePath('/dashboard/boutiques');
  // Le nom de la boutique s'affiche aussi dans le sélecteur du layout et sur
  // les fiches produit.
  revalidatePath('/dashboard', 'layout');
  return { succes: 'Boutique mise à jour.' };
}

export async function supprimerBoutique(
  _etat: EtatBoutique,
  donnees: FormData,
): Promise<EtatBoutique> {
  try {
    await appelApi(`/boutiques/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Suppression impossible.' };
  }
  revalidatePath('/dashboard/boutiques');
  return { succes: 'Boutique supprimée.' };
}
