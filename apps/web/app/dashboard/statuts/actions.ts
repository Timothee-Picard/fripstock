'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';
import type { Statut } from '@/lib/types';

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

export async function creerStatut(_etat: EtatStatut, donnees: FormData): Promise<EtatStatut> {
  const nom = String(donnees.get('nom') ?? '').trim();
  if (!nom) return { erreur: 'Le nom est obligatoire.' };

  try {
    await appelApi('/statuts', {
      method: 'POST',
      body: JSON.stringify({
        nom,
        couleur: String(donnees.get('couleur') ?? '#6b7280'),
        estVente: donnees.get('estVente') === 'on',
        bloqueVente: donnees.get('bloqueVente') === 'on',
        sortStock: donnees.get('sortStock') === 'on',
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Création impossible.');
  }
  rafraichir();
  return { succes: `Statut « ${nom} » créé.` };
}

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

/**
 * Déplace un statut d'un cran en échangeant son `ordre` avec son voisin.
 *
 * Deux appels plutôt qu'un endpoint dédié : l'ordre est purement cosmétique,
 * une interruption entre les deux laisserait au pire deux statuts au même
 * rang — sans conséquence métier.
 */
export async function deplacerStatut(_etat: EtatStatut, donnees: FormData): Promise<EtatStatut> {
  const id = String(donnees.get('id'));
  const sens = String(donnees.get('sens'));

  try {
    const statuts = await appelApi<Statut[]>('/statuts');
    const index = statuts.findIndex((s) => s.id === id);
    const voisin = statuts[sens === 'haut' ? index - 1 : index + 1];
    if (index === -1 || !voisin) return {};

    const courant = statuts[index];
    // Les rangs peuvent être égaux (statuts créés en lot) : on force un écart.
    const rangCourant = courant.ordre === voisin.ordre ? index : courant.ordre;
    const rangVoisin =
      courant.ordre === voisin.ordre ? index + (sens === 'haut' ? -1 : 1) : voisin.ordre;

    await appelApi(`/statuts/${courant.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ordre: rangVoisin }),
    });
    await appelApi(`/statuts/${voisin.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ordre: rangCourant }),
    });
  } catch (erreur) {
    return message(erreur, 'Déplacement impossible.');
  }
  rafraichir();
  return {};
}

export async function supprimerStatut(_etat: EtatStatut, donnees: FormData): Promise<EtatStatut> {
  try {
    await appelApi(`/statuts/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return message(erreur, 'Suppression impossible.');
  }
  rafraichir();
  return { succes: 'Statut supprimé.' };
}

/**
 * Enregistre le schéma du flux : positions des statuts et flèches autorisées.
 *
 * Envoi intégral plutôt qu'une modification à la fois — c'est l'état du canevas
 * au moment où le gérant enregistre.
 */
export async function enregistrerFlux(
  positions: { id: string; x: number; y: number }[],
  transitions: { sourceId: string; cibleId: string }[],
): Promise<EtatStatut> {
  try {
    await appelApi('/statuts/flux', {
      method: 'PUT',
      body: JSON.stringify({ positions, transitions }),
    });
  } catch (erreur) {
    return message(erreur, 'Enregistrement du flux impossible.');
  }
  rafraichir();
  return { succes: 'Flux enregistré.' };
}
