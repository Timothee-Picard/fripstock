import { SetMetadata } from '@nestjs/common';

export const MANAGER_KEY = 'managerOnly';

/**
 * Réserve la route au gérant de l'entreprise. Utilisé là où il n'existe pas de
 * permission fine : créer une boutique, inviter un employé, gérer les statuts.
 */
export const ManagerOnly = () => SetMetadata(MANAGER_KEY, true);
