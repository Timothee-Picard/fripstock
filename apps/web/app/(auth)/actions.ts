'use server';

import { redirect } from 'next/navigation';
import { appelApiPublic, ErreurApi } from '@/lib/api';
import { effacerJeton, poserJeton } from '@/lib/session';

export interface EtatFormulaire {
  erreur?: string;
}

interface ReponseAuth {
  accessToken: string;
}

export async function connexion(_etat: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  try {
    const reponse = await appelApiPublic<ReponseAuth>('/auth/login', {
      email: String(donnees.get('email') ?? ''),
      motDePasse: String(donnees.get('motDePasse') ?? ''),
    });
    await poserJeton(reponse.accessToken);
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Connexion impossible.' };
  }
  // Hors du try : redirect() lève une exception de contrôle que le catch
  // avalerait en la présentant comme une erreur de connexion.
  redirect('/dashboard');
}

export async function inscription(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  try {
    const reponse = await appelApiPublic<ReponseAuth>('/auth/register', {
      nomEntreprise: String(donnees.get('nomEntreprise') ?? ''),
      email: String(donnees.get('email') ?? ''),
      motDePasse: String(donnees.get('motDePasse') ?? ''),
      prenom: String(donnees.get('prenom') ?? ''),
      nom: String(donnees.get('nom') ?? ''),
    });
    await poserJeton(reponse.accessToken);
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Inscription impossible.' };
  }
  redirect('/dashboard');
}

export async function deconnexion(): Promise<void> {
  await effacerJeton();
  redirect('/login');
}
