'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { clearToken, setToken } from '@/lib/session';

export interface ProfileState {
  error?: string;
  success?: string;
}

export async function updateProfile(_state: ProfileState, data: FormData): Promise<ProfileState> {
  const currentPassword = String(data.get('currentPassword') ?? '').trim();

  try {
    await apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: String(data.get('firstName') ?? '').trim(),
        lastName: String(data.get('lastName') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        // Envoyé seulement s'il est rempli : l'API ne l'exige que si l'email
        // change réellement.
        ...(currentPassword ? { currentPassword } : {}),
      }),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Modification impossible.' };
  }

  // Le layout affiche le nom : il doit se rafraîchir aussi.
  revalidatePath('/dashboard', 'layout');
  return { success: 'Profil mis à jour.' };
}

export async function changePassword(_state: ProfileState, data: FormData): Promise<ProfileState> {
  const isNew = String(data.get('newPassword') ?? '');
  if (isNew !== String(data.get('confirmation') ?? '')) {
    return { error: 'Les deux mots de passe ne correspondent pas.' };
  }

  try {
    const response = await apiFetch<{ accessToken: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: String(data.get('currentPassword') ?? ''),
        newPassword: isNew,
      }),
    });
    // L'API renvoie un jeton neuf : sans ça, la session courante continuerait
    // avec l'ancien, valide jusqu'à son expiration.
    await setToken(response.accessToken);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Changement impossible.' };
  }

  return { success: 'Mot de passe modifié.' };
}

/**
 * Suppression du compte : l'entreprise entière, définitivement.
 *
 * Le mot de passe accompagne la demande — c'est ce que l'API réexige, et la
 * modale le demande donc au moment du geste plutôt que sur l'écran.
 */
export async function deleteAccount(_state: ProfileState, data: FormData): Promise<ProfileState> {
  try {
    await apiFetch('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password: String(data.get('password') ?? '') }),
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Suppression impossible.' };
  }

  // Le jeton désigne un compte qui n'existe plus : le garder ferait échouer
  // chaque écran sur un 401 plutôt que ramener à la connexion.
  await clearToken();
  // Hors du try : redirect() lève une exception de contrôle que le catch
  // présenterait comme un échec de suppression.
  redirect('/login');
}
