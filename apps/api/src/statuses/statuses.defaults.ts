/**
 * Default flow created with a new company.
 *
 * The positions draw the item's path from left to right, one column per stage:
 * intake, then the shop floor, then the three ways out. Grouping every
 * `leavesStock` status in the last column keeps the active path readable — it
 * is the one a manager follows every day.
 */
export const BASE_STATUSES = [
  {
    name: 'En stock',
    color: '#6b7280',
    isDefault: true,
    isSale: false,
    blocksSale: false,
    leavesStock: false,
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
    positionX: 660,
    positionY: 20,
  },
  {
    name: 'Rendu au client',
    color: '#8b5cf6',
    isDefault: false,
    isSale: false,
    blocksSale: true,
    leavesStock: true,
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
    positionX: 660,
    positionY: 320,
  },
] as const;

/**
 * Default transitions, by status name.
 *
 * "Vendu" leads back to "En rayon": a customer return goes on vente again. Both
 * blocking statuses are end points — a returned or withdrawn item has no
 * follow-up, which `blocksSale` enforces anyway.
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
];
