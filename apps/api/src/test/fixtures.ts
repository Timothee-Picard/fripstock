import type { CurrentUser } from '../common/types/current-user';

export const COMPANY_ID = 'company-1';
export const OTHER_COMPANY_ID = 'company-2';
export const SHOP_ID = 'shop-1';
export const OTHER_SHOP_ID = 'shop-2';

export const manager: CurrentUser = {
  userId: 'user-manager',
  companyId: COMPANY_ID,
  isManager: true,
};

export const employee: CurrentUser = {
  userId: 'user-employee',
  companyId: COMPANY_ID,
  isManager: false,
};

/** Statut « En stock » : ni vente, ni blocage, ni sortie d'inventaire. */
export const inStock = {
  id: 'status-stock',
  companyId: COMPANY_ID,
  name: 'En stock',
  color: '#6b7280',
  position: 0,
  isDefault: true,
  isSale: false,
  blocksSale: false,
  leavesStock: false,
  positionX: null,
  positionY: null,
};

export const sold = {
  ...inStock,
  id: 'status-sold',
  name: 'Vendu',
  isDefault: false,
  isSale: true,
  leavesStock: true,
};
export const returned = {
  ...inStock,
  id: 'status-returned',
  name: 'Rendu au client',
  isDefault: false,
  blocksSale: true,
  leavesStock: true,
};
