'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatProduit {
  erreur?: string;
  succes?: string;
  /**
   * Marqueur unique par succès. Il permet à un formulaire de savoir qu'une
   * nouvelle réussite est arrivée — le libellé de succès, lui, est identique
   * d'une fois sur l'autre — et donc de dériver sa remise à zéro plutôt que de
   * la poser dans un effet.
   */
  jeton?: string;
}

function message(erreur: unknown, defaut: string): EtatProduit {
  return { erreur: erreur instanceof ErreurApi ? erreur.message : defaut };
}

/** Les valeurs d'attributs arrivent sous la forme `attr:<id>`. */
function lireAttributs(donnees: FormData): { attributDefinitionId: string; valeur: unknown }[] {
  const resultat: { attributDefinitionId: string; valeur: unknown }[] = [];
  const multiples = new Map<string, string[]>();

  for (const [cle, brut] of donnees.entries()) {
    if (!cle.startsWith('attr:')) continue;
    const id = cle.slice(5);
    const valeur = String(brut);
    if (valeur === '') continue;

    if (multiples.has(id)) {
      multiples.get(id)!.push(valeur);
    } else {
      multiples.set(id, [valeur]);
    }
  }

  for (const [attributDefinitionId, valeurs] of multiples) {
    // Une case cochée seule et un multiselect à une valeur sont indiscernables
    // ici : l'API accepte les deux formes et normalise selon le type réel.
    resultat.push({ attributDefinitionId, valeur: valeurs.length === 1 ? valeurs[0] : valeurs });
  }
  return resultat;
}

function nombreOuRien(donnees: FormData, champ: string): number | undefined {
  const brut = String(donnees.get(champ) ?? '').trim();
  if (brut === '') return undefined;
  const n = Number(brut.replace(',', '.'));
  return Number.isNaN(n) ? undefined : n;
}

export async function creerProduit(_etat: EtatProduit, donnees: FormData): Promise<EtatProduit> {
  const boutiqueId = String(donnees.get('boutiqueId') ?? '');
  let id: string;

  try {
    const cree = await appelApi<{ id: string }>('/produits', {
      method: 'POST',
      body: JSON.stringify({
        nom: String(donnees.get('nom') ?? '').trim(),
        categorieId: String(donnees.get('categorieId') ?? ''),
        typeVente: String(donnees.get('typeVente') ?? 'ACHAT_REVENTE'),
        boutiqueId: boutiqueId || null,
        reference: String(donnees.get('reference') ?? '').trim() || undefined,
        description: String(donnees.get('description') ?? '').trim() || undefined,
        commentaire: String(donnees.get('commentaire') ?? '').trim() || undefined,
        photoUrl: String(donnees.get('photoUrl') ?? '').trim() || undefined,
        prixAchat: nombreOuRien(donnees, 'prixAchat'),
        prixVente: nombreOuRien(donnees, 'prixVente'),
        quantite: nombreOuRien(donnees, 'quantite'),
        attributs: lireAttributs(donnees),
      }),
    });
    id = cree.id;
  } catch (erreur) {
    return message(erreur, 'Création impossible.');
  }

  revalidatePath('/dashboard/produits');
  // Hors du try : redirect() lève une exception de contrôle que le catch
  // présenterait comme une erreur de création.
  redirect(`/dashboard/produits/${id}`);
}

export async function changerStatut(_etat: EtatProduit, donnees: FormData): Promise<EtatProduit> {
  const id = String(donnees.get('id'));
  const prixVendu = nombreOuRien(donnees, 'prixVendu');

  try {
    await appelApi(`/produits/${id}/statut`, {
      method: 'PUT',
      body: JSON.stringify({
        statutId: String(donnees.get('statutId')),
        ...(prixVendu !== undefined ? { prixVendu } : {}),
        ...(String(donnees.get('note') ?? '').trim()
          ? { note: String(donnees.get('note')).trim() }
          : {}),
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Changement de statut impossible.');
  }

  revalidatePath('/dashboard/produits');
  revalidatePath(`/dashboard/produits/${id}`);
  return { succes: 'Statut mis à jour.', jeton: randomUUID() };
}

export async function assignerBoutique(
  _etat: EtatProduit,
  donnees: FormData,
): Promise<EtatProduit> {
  const id = String(donnees.get('id'));
  const boutiqueId = String(donnees.get('boutiqueId') ?? '');

  try {
    await appelApi(`/produits/${id}/assigner-boutique`, {
      method: 'PUT',
      body: JSON.stringify({ boutiqueId: boutiqueId || null }),
    });
  } catch (erreur) {
    return message(erreur, 'Assignation impossible.');
  }

  revalidatePath('/dashboard/produits');
  revalidatePath(`/dashboard/produits/${id}`);
  return { succes: 'Boutique mise à jour.' };
}

export async function supprimerProduit(
  _etat: EtatProduit,
  donnees: FormData,
): Promise<EtatProduit> {
  try {
    await appelApi(`/produits/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return message(erreur, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/produits');
  redirect('/dashboard/produits');
}

/**
 * Modification d'un produit existant.
 *
 * Les attributs sont renvoyés en entier : l'API les revalide contre la
 * catégorie finale, qui a pu changer et rendre certains inapplicables.
 */
export async function modifierProduit(_etat: EtatProduit, donnees: FormData): Promise<EtatProduit> {
  const id = String(donnees.get('id'));
  const boutiqueId = String(donnees.get('boutiqueId') ?? '');
  const typeVente = String(donnees.get('typeVente') ?? 'ACHAT_REVENTE');

  try {
    await appelApi(`/produits/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nom: String(donnees.get('nom') ?? '').trim(),
        categorieId: String(donnees.get('categorieId') ?? ''),
        typeVente,
        boutiqueId: boutiqueId || null,
        reference: String(donnees.get('reference') ?? '').trim(),
        description: String(donnees.get('description') ?? '').trim(),
        commentaire: String(donnees.get('commentaire') ?? '').trim(),
        photoUrl: String(donnees.get('photoUrl') ?? '').trim(),
        prixAchat: typeVente === 'ACHAT_REVENTE' ? nombreOuRien(donnees, 'prixAchat') : undefined,
        prixVente: nombreOuRien(donnees, 'prixVente'),
        quantite: nombreOuRien(donnees, 'quantite'),
        attributs: lireAttributs(donnees),
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Modification impossible.');
  }

  revalidatePath('/dashboard/produits');
  revalidatePath(`/dashboard/produits/${id}`);
  redirect(`/dashboard/produits/${id}`);
}

/**
 * Corrige une vente déjà enregistrée : prix encaissé, date, commission.
 *
 * Distinct du changement de statut, qui trace l'historique : ici on rectifie
 * une saisie, on ne fait pas franchir une étape au produit.
 */
export async function modifierVente(_etat: EtatProduit, donnees: FormData): Promise<EtatProduit> {
  const id = String(donnees.get('id'));
  const commission = nombreOuRien(donnees, 'commissionAppliquee');

  try {
    await appelApi(`/produits/${id}/vente`, {
      method: 'PUT',
      body: JSON.stringify({
        prixVendu: nombreOuRien(donnees, 'prixVendu'),
        dateVente: String(donnees.get('dateVente') ?? '')
          ? new Date(String(donnees.get('dateVente'))).toISOString()
          : undefined,
        ...(commission !== undefined ? { commissionAppliquee: commission } : {}),
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Correction impossible.');
  }

  revalidatePath('/dashboard/produits');
  revalidatePath(`/dashboard/produits/${id}`);
  return { succes: 'Vente corrigée.', jeton: randomUUID() };
}
