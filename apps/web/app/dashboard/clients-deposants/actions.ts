'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatClient {
  erreur?: string;
  succes?: string;
}

function message(erreur: unknown, defaut: string): EtatClient {
  return { erreur: erreur instanceof ErreurApi ? erreur.message : defaut };
}

/** Champs communs à la création et à la modification. */
function corps(donnees: FormData) {
  const texte = (cle: string) => String(donnees.get(cle) ?? '').trim();
  const commission = texte('commissionDefaut').replace(',', '.');
  return {
    nom: texte('nom'),
    prenom: texte('prenom') || undefined,
    email: texte('email') || undefined,
    telephone: texte('telephone') || undefined,
    adresse: texte('adresse') || undefined,
    // Les IBAN se notent souvent avec des espaces : on les retire avant l'API,
    // qui les refuserait.
    iban: texte('iban').replace(/\s+/g, '').toUpperCase() || undefined,
    commissionDefaut: commission === '' ? undefined : Number(commission),
  };
}

export async function creerClient(_etat: EtatClient, donnees: FormData): Promise<EtatClient> {
  if (!String(donnees.get('nom') ?? '').trim()) return { erreur: 'Le nom est obligatoire.' };
  try {
    await appelApi('/clients-deposants', { method: 'POST', body: JSON.stringify(corps(donnees)) });
  } catch (erreur) {
    return message(erreur, 'Création impossible.');
  }
  revalidatePath('/dashboard/clients-deposants');
  return { succes: 'Déposant créé.' };
}

export async function modifierClient(_etat: EtatClient, donnees: FormData): Promise<EtatClient> {
  const id = String(donnees.get('id'));
  try {
    await appelApi(`/clients-deposants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(corps(donnees)),
    });
  } catch (erreur) {
    return message(erreur, 'Modification impossible.');
  }
  revalidatePath('/dashboard/clients-deposants');
  revalidatePath(`/dashboard/clients-deposants/${id}`);
  return { succes: 'Déposant mis à jour.' };
}

export async function supprimerClient(_etat: EtatClient, donnees: FormData): Promise<EtatClient> {
  try {
    await appelApi(`/clients-deposants/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return message(erreur, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/clients-deposants');
  redirect('/dashboard/clients-deposants');
}
