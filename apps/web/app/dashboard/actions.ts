'use server';

import { apiFetch, ApiError } from '@/lib/api';
import type { DashboardLayoutEntry } from '@/lib/types';

/**
 * Enregistre le rangement des modules du tableau de bord.
 *
 * Le rangement complet part d'un coup — pas un déplacement isolé : l'écran
 * connaît l'ordre entier au moment où il l'enregistre, et deux onglets ouverts
 * sur le même compte aboutissent alors à l'un des deux rangements plutôt qu'à
 * leur mélange.
 *
 * Un refus n'est pas une page en erreur : la préférence n'a pas été gardée, le
 * tableau de bord reste lisible, on le dit et c'est tout.
 */
export async function saveDashboardLayout(
  modules: DashboardLayoutEntry[],
): Promise<{ error?: string }> {
  try {
    await apiFetch('/stats/layout', { method: 'PUT', body: JSON.stringify({ modules }) });
    return {};
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Le rangement n'a pas pu être enregistré. Réessayez.",
    };
  }
}
