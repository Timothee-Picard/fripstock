'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatContrat {
  erreur?: string;
  succes?: string;
}

function message(erreur: unknown, defaut: string): EtatContrat {
  return { erreur: erreur instanceof ErreurApi ? erreur.message : defaut };
}

function rafraichir(id?: string) {
  revalidatePath('/dashboard/contrats-depot');
  if (id) revalidatePath(`/dashboard/contrats-depot/${id}`);
  revalidatePath('/dashboard/clients-deposants', 'layout');
}

/** `2026-08-26` (input date) → ISO complet attendu par l'API. */
function jour(donnees: FormData, cle: string): string | undefined {
  const brut = String(donnees.get(cle) ?? '').trim();
  return brut ? new Date(`${brut}T00:00:00Z`).toISOString() : undefined;
}

function nombre(donnees: FormData, cle: string): number | undefined {
  const brut = String(donnees.get(cle) ?? '')
    .trim()
    .replace(',', '.');
  if (brut === '') return undefined;
  const n = Number(brut);
  return Number.isNaN(n) ? undefined : n;
}

export async function creerContrat(_etat: EtatContrat, donnees: FormData): Promise<EtatContrat> {
  let id: string;
  try {
    const cree = await appelApi<{ id: string }>('/contrats-depot', {
      method: 'POST',
      body: JSON.stringify({
        clientId: String(donnees.get('clientId') ?? ''),
        dateDebut: jour(donnees, 'dateDebut'),
        dateFin: jour(donnees, 'dateFin'),
        commission: nombre(donnees, 'commission'),
        notifyBeforeDays: nombre(donnees, 'notifyBeforeDays'),
      }),
    });
    id = cree.id;
  } catch (erreur) {
    return message(erreur, 'Création impossible.');
  }
  rafraichir();
  redirect(`/dashboard/contrats-depot/${id}`);
}

export async function modifierContrat(_etat: EtatContrat, donnees: FormData): Promise<EtatContrat> {
  const id = String(donnees.get('id'));
  try {
    await appelApi(`/contrats-depot/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        dateDebut: jour(donnees, 'dateDebut'),
        dateFin: jour(donnees, 'dateFin'),
        commission: nombre(donnees, 'commission'),
        notifyBeforeDays: nombre(donnees, 'notifyBeforeDays'),
        ...(donnees.get('statut') ? { statut: String(donnees.get('statut')) } : {}),
      }),
    });
  } catch (erreur) {
    return message(erreur, 'Modification impossible.');
  }
  rafraichir(id);
  return { succes: 'Contrat mis à jour.' };
}

export async function rattacherProduits(
  _etat: EtatContrat,
  donnees: FormData,
): Promise<EtatContrat> {
  const id = String(donnees.get('id'));
  const produitIds = donnees.getAll('produitId').map(String);
  if (produitIds.length === 0) return { erreur: 'Choisissez au moins un produit.' };

  try {
    await appelApi(`/contrats-depot/${id}/produits`, {
      method: 'POST',
      body: JSON.stringify({ produitIds }),
    });
  } catch (erreur) {
    return message(erreur, 'Rattachement impossible.');
  }
  rafraichir(id);
  revalidatePath('/dashboard/produits', 'layout');
  return { succes: `${produitIds.length} produit(s) rattaché(s).` };
}

export async function detacherProduit(_etat: EtatContrat, donnees: FormData): Promise<EtatContrat> {
  const id = String(donnees.get('id'));
  try {
    await appelApi(`/contrats-depot/${id}/produits/${String(donnees.get('produitId'))}`, {
      method: 'DELETE',
    });
  } catch (erreur) {
    return message(erreur, 'Détachement impossible.');
  }
  rafraichir(id);
  revalidatePath('/dashboard/produits', 'layout');
  return { succes: 'Produit détaché.' };
}

export async function supprimerContrat(
  _etat: EtatContrat,
  donnees: FormData,
): Promise<EtatContrat> {
  try {
    await appelApi(`/contrats-depot/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return message(erreur, 'Suppression impossible.');
  }
  rafraichir();
  redirect('/dashboard/contrats-depot');
}

/** Lance la passe d'échéances à la main, sans attendre le lendemain. */
export async function lancerEcheances(): Promise<EtatContrat> {
  try {
    const r = await appelApi<{ notifies: number; expires: number }>('/contrats-depot/echeances', {
      method: 'POST',
    });
    rafraichir();
    revalidatePath('/dashboard', 'layout');
    return {
      succes: `${r.notifies} alerte(s) créée(s), ${r.expires} contrat(s) passé(s) en expiré.`,
    };
  } catch (erreur) {
    return message(erreur, 'Vérification impossible.');
  }
}
