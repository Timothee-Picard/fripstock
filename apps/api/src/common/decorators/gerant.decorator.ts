import { SetMetadata } from '@nestjs/common';

export const CLE_GERANT = 'gerantUniquement';

/**
 * Réserve la route au gérant de l'entreprise. Utilisé là où il n'existe pas de
 * permission fine : créer une boutique, inviter un employé, gérer les statuts.
 */
export const GerantUniquement = () => SetMetadata(CLE_GERANT, true);
