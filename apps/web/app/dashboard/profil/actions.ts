'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';
import { poserJeton } from '@/lib/session';

export interface EtatProfil {
  erreur?: string;
  succes?: string;
}

export async function modifierProfil(_etat: EtatProfil, donnees: FormData): Promise<EtatProfil> {
  const motDePasseActuel = String(donnees.get('motDePasseActuel') ?? '').trim();

  try {
    await appelApi('/auth/profil', {
      method: 'PUT',
      body: JSON.stringify({
        prenom: String(donnees.get('prenom') ?? '').trim(),
        nom: String(donnees.get('nom') ?? '').trim(),
        email: String(donnees.get('email') ?? '').trim(),
        // Envoyé seulement s'il est rempli : l'API ne l'exige que si l'email
        // change réellement.
        ...(motDePasseActuel ? { motDePasseActuel } : {}),
      }),
    });
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Modification impossible.' };
  }

  // Le layout affiche le nom : il doit se rafraîchir aussi.
  revalidatePath('/dashboard', 'layout');
  return { succes: 'Profil mis à jour.' };
}

export async function changerMotDePasse(_etat: EtatProfil, donnees: FormData): Promise<EtatProfil> {
  const nouveau = String(donnees.get('nouveauMotDePasse') ?? '');
  if (nouveau !== String(donnees.get('confirmation') ?? '')) {
    return { erreur: 'Les deux mots de passe ne correspondent pas.' };
  }

  try {
    const reponse = await appelApi<{ accessToken: string }>('/auth/mot-de-passe', {
      method: 'PUT',
      body: JSON.stringify({
        motDePasseActuel: String(donnees.get('motDePasseActuel') ?? ''),
        nouveauMotDePasse: nouveau,
      }),
    });
    // L'API renvoie un jeton neuf : sans ça, la session courante continuerait
    // avec l'ancien, valide jusqu'à son expiration.
    await poserJeton(reponse.accessToken);
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Changement impossible.' };
  }

  return { succes: 'Mot de passe modifié.' };
}
