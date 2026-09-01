/**
 * Default flow created with a new company.
 *
 * The positions draw the item's path from left to right, one column per stage:
 * intake, then the shop floor, then the four ways out. Grouping every
 * `leavesStock` status in the last column keeps the active path readable — it
 * is the one a manager follows every day.
 *
 * "Vendu" and "Vendu en ligne" are two statuses rather than one status plus a
 * channel field: a sale has exactly one channel, so it fits what a status is —
 * a single value at a time. Being *listed* online does not, which is why that
 * one is a flag on the product instead.
 */
export const BASE_STATUSES = [
  {
    name: 'En stock',
    color: '#6b7280',
    isDefault: true,
    isSale: false,
    blocksSale: false,
    leavesStock: false,
    isOnlineSale: false,
    positionX: 0,
    positionY: 150,
  },
  {
    name: 'En rayon',
    color: '#3b82f6',
    isDefault: false,
    isSale: false,
    blocksSale: false,
    leavesStock: false,
    isOnlineSale: false,
    positionX: 320,
    positionY: 40,
  },
  {
    name: 'Réservé',
    color: '#f59e0b',
    isDefault: false,
    isSale: false,
    blocksSale: false,
    leavesStock: false,
    isOnlineSale: false,
    positionX: 320,
    positionY: 260,
  },
  {
    name: 'Vendu',
    color: '#10b981',
    isDefault: false,
    isSale: true,
    blocksSale: false,
    leavesStock: true,
    isOnlineSale: false,
    positionX: 660,
    positionY: 20,
  },
  {
    name: 'Vendu en ligne',
    color: '#0ea5e9',
    isDefault: false,
    isSale: true,
    blocksSale: false,
    leavesStock: true,
    isOnlineSale: true,
    positionX: 660,
    positionY: 95,
  },
  {
    name: 'Rendu au client',
    color: '#8b5cf6',
    isDefault: false,
    isSale: false,
    blocksSale: true,
    leavesStock: true,
    isOnlineSale: false,
    positionX: 660,
    positionY: 170,
  },
  {
    name: 'Retiré',
    color: '#ef4444',
    isDefault: false,
    isSale: false,
    blocksSale: true,
    leavesStock: true,
    isOnlineSale: false,
    positionX: 660,
    positionY: 320,
  },
] as const;

/**
 * Default transitions, by status name.
 *
 * Both sale statuses lead back to "En rayon": a customer return goes on vente
 * again, whichever channel sold it. Both blocking statuses are end points — a
 * returned or withdrawn item has no follow-up, which `blocksSale` enforces
 * anyway.
 */
export const BASE_TRANSITIONS: [string, string][] = [
  ['En stock', 'En rayon'],
  ['En stock', 'Réservé'],
  // Un client peut acheter un article sorti de la réserve : lui imposer un
  // passage par le rayon bloquerait la vente au comptoir pour rien.
  ['En stock', 'Vendu'],
  ['En stock', 'Retiré'],
  ['En stock', 'Rendu au client'],
  ['En rayon', 'En stock'],
  ['En rayon', 'Réservé'],
  ['En rayon', 'Vendu'],
  ['En rayon', 'Retiré'],
  ['En rayon', 'Rendu au client'],
  ['Réservé', 'En rayon'],
  ['Réservé', 'En stock'],
  ['Réservé', 'Vendu'],
  ['Réservé', 'Retiré'],
  ['Réservé', 'Rendu au client'],
  ['Vendu', 'En rayon'],
  // La vente en ligne part des trois mêmes points que la vente au comptoir.
  // Passer par « Réservé » reste possible — c'est ce qu'on fait pour un
  // article encore en rayon, pour que personne ne le vende pendant la
  // préparation du colis — mais n'est pas imposé : un article en réserve part
  // directement.
  ['En stock', 'Vendu en ligne'],
  ['En rayon', 'Vendu en ligne'],
  ['Réservé', 'Vendu en ligne'],
  ['Vendu en ligne', 'En rayon'],
];
