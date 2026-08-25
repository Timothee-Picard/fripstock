'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';

export interface EtatAttribut {
  erreur?: string;
  succes?: string;
}

function message(erreur: unknown, defaut: string): EtatAttribut {
  return { erreur: erreur instanceof ErreurApi ? erreur.message : defaut };
}

/** Découpe une saisie « S, M, L » ou une option par ligne. */
function decouperOptions(brut: string): { valeur: string }[] {
  return brut
    .split(/[\n,;]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((valeur) => ({ valeur }));
}

export async function clonerTemplate(
  _etat: EtatAttribut,
  donnees: FormData,
): Promise<EtatAttribut> {
  try {
    await appelApi(`/attributs/from-template/${String(donnees.get('templateId'))}`, {
      method: 'POST',
    });
  } catch (erreur) {
    return message(erreur, 'Clonage impossible.');
  }
  revalidatePath('/dashboard/attributs');
  return { succes: `« ${String(donnees.get('nom'))} » ajouté depuis le modèle.` };
}

export async function creerAttribut(_etat: EtatAttribut, donnees: FormData): Promise<EtatAttribut> {
  const nom = String(donnees.get('nom') ?? '').trim();
  const type = String(donnees.get('type') ?? '');
  const options = decouperOptions(String(donnees.get('options') ?? ''));

  if (!nom) return { erreur: 'Le nom est obligatoire.' };
  if ((type === 'SELECT' || type === 'MULTISELECT') && options.length === 0) {
    return { erreur: 'Ce type a besoin d’au moins une option.' };
  }

  try {
    await appelApi('/attributs', {
      method: 'POST',
      body: JSON.stringify({ nom, type, options }),
    });
  } catch (erreur) {
    return message(erreur, 'Création impossible.');
  }
  revalidatePath('/dashboard/attributs');
  return { succes: `Attribut « ${nom} » créé.` };
}

export async function renommerAttribut(
  _etat: EtatAttribut,
  donnees: FormData,
): Promise<EtatAttribut> {
  try {
    await appelApi(`/attributs/${String(donnees.get('id'))}`, {
      method: 'PUT',
      body: JSON.stringify({ nom: String(donnees.get('nom') ?? '').trim() }),
    });
  } catch (erreur) {
    return message(erreur, 'Renommage impossible.');
  }
  revalidatePath('/dashboard/attributs');
  return { succes: 'Attribut renommé.' };
}

/**
 * Envoie la liste complète et ordonnée : l'API crée les nouvelles valeurs,
 * renomme celles qui ont un id, et supprime les absentes.
 */
export async function definirOptions(
  _etat: EtatAttribut,
  donnees: FormData,
): Promise<EtatAttribut> {
  const options = decouperOptions(String(donnees.get('options') ?? ''));
  if (options.length === 0) return { erreur: 'Il faut conserver au moins une option.' };

  try {
    await appelApi(`/attributs/${String(donnees.get('id'))}/options`, {
      method: 'PUT',
      body: JSON.stringify({ options }),
    });
  } catch (erreur) {
    return message(erreur, 'Enregistrement impossible.');
  }
  revalidatePath('/dashboard/attributs');
  return { succes: 'Options enregistrées.' };
}

export async function supprimerAttribut(
  _etat: EtatAttribut,
  donnees: FormData,
): Promise<EtatAttribut> {
  try {
    await appelApi(`/attributs/${String(donnees.get('id'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return message(erreur, 'Suppression impossible.');
  }
  revalidatePath('/dashboard/attributs');
  return { succes: 'Attribut supprimé.' };
}
