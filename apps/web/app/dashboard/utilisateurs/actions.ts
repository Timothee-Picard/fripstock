'use server';

import { revalidatePath } from 'next/cache';
import { appelApi, ErreurApi } from '@/lib/api';
import { PERMISSIONS, type Permission } from '@/lib/types';

export interface EtatUtilisateur {
  erreur?: string;
  succes?: string;
  motDePasseTemporaire?: string;
}

export async function inviterEmploye(
  _etat: EtatUtilisateur,
  donnees: FormData,
): Promise<EtatUtilisateur> {
  try {
    const cree = await appelApi<{ motDePasseTemporaire?: string; prenom: string; nom: string }>(
      '/users/invite',
      {
        method: 'POST',
        body: JSON.stringify({
          email: String(donnees.get('email') ?? '').trim(),
          prenom: String(donnees.get('prenom') ?? '').trim(),
          nom: String(donnees.get('nom') ?? '').trim(),
        }),
      },
    );
    revalidatePath('/dashboard/utilisateurs');
    return {
      succes: `${cree.prenom} ${cree.nom} a été invité.`,
      motDePasseTemporaire: cree.motDePasseTemporaire,
    };
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Invitation impossible.' };
  }
}

/**
 * Les cases cochées arrivent sous la forme `perm:<boutiqueId>:<permission>`.
 * On reconstruit la liste complète des accès, parce que l'API remplace
 * intégralement ceux de l'employé.
 */
export async function enregistrerAcces(
  _etat: EtatUtilisateur,
  donnees: FormData,
): Promise<EtatUtilisateur> {
  const userId = String(donnees.get('userId') ?? '');
  const boutiqueIds = donnees.getAll('boutiqueId').map(String);

  const acces = boutiqueIds
    .map((boutiqueId) => ({
      boutiqueId,
      permissions: PERMISSIONS.filter((p) =>
        donnees.has(`perm:${boutiqueId}:${p}`),
      ) as Permission[],
    }))
    // Une boutique sans aucune permission n'est pas un accès : on la retire.
    .filter((a) => a.permissions.length > 0);

  try {
    await appelApi(`/users/${userId}/acces`, {
      method: 'PUT',
      body: JSON.stringify({ acces }),
    });
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Enregistrement impossible.' };
  }

  revalidatePath('/dashboard/utilisateurs');
  return { succes: 'Permissions enregistrées.' };
}

export async function supprimerEmploye(
  _etat: EtatUtilisateur,
  donnees: FormData,
): Promise<EtatUtilisateur> {
  try {
    await appelApi(`/users/${String(donnees.get('userId'))}`, { method: 'DELETE' });
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurApi ? erreur.message : 'Suppression impossible.' };
  }
  revalidatePath('/dashboard/utilisateurs');
  return { succes: 'Employé supprimé.' };
}
