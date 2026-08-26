'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatStatut {
  erreur?: string;
  succes?: string;
}

function message(erreur: unknown, defaut: string): EtatStatut {
  return { erreur: erreur instanceof ErreurApi ? erreur.message : defaut };
}

function rafraichir() {
  revalidatePath('/dashboard/statuts');
  // Les badges et les listes déroulantes de statut se trouvent aussi ailleurs.
  revalidatePath('/dashboard/produits', 'layout');
}

/**
 * Renomme et recolore un statut.
 *
 * Ni création ni suppression : le flux référence les statuts, un statut ajouté
 * n'aurait aucune flèche et resterait inatteignable. Le libellé, lui, reste
 * libre — c'est précisément pour ça que le comportement tient à des flags.
 */
export async function modifierStatut(_etat: EtatStatut, donnees: FormData): Promise<EtatStatut> {
  try {
    await appelApi(`/statuts/${String(donnees.get('id'))}`, {
      method: 'PUT',
      body: JSON.stringify({
        nom: String(donnees.get('nom') ?? '').trim(),
        couleur: String(donnees.get('couleur') ?? '#6b7280'),
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Modification impossible.');
  }
  rafraichir();
  return { succes: 'Statut mis à jour.' };
}

export async function definirParDefaut(_etat: EtatStatut, donnees: FormData): Promise<EtatStatut> {
  try {
    await appelApi(`/statuts/${String(donnees.get('id'))}/par-defaut`, { method: 'PUT' });
  } catch (erreur) {
    return message(erreur, 'Changement impossible.');
  }
  rafraichir();
  return { succes: 'Statut par défaut mis à jour.' };
}
