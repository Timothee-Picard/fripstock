/**
 * Flux de base créé avec une nouvelle entreprise.
 *
 * Les positions dessinent le parcours normal d'un article de gauche à droite,
 * avec les sorties (rendu, retiré) en dessous. Le gérant réorganise ensuite
 * comme il veut.
 */
export const STATUTS_DE_BASE = [
  {
    nom: 'En stock',
    couleur: '#6b7280',
    estDefaut: true,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
    positionX: 0,
    positionY: 120,
  },
  {
    nom: 'En rayon',
    couleur: '#3b82f6',
    estDefaut: false,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
    positionX: 260,
    positionY: 40,
  },
  {
    nom: 'Réservé',
    couleur: '#f59e0b',
    estDefaut: false,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
    positionX: 260,
    positionY: 200,
  },
  {
    nom: 'Vendu',
    couleur: '#10b981',
    estDefaut: false,
    estVente: true,
    bloqueVente: false,
    sortStock: true,
    positionX: 540,
    positionY: 40,
  },
  {
    nom: 'Rendu au client',
    couleur: '#8b5cf6',
    estDefaut: false,
    estVente: false,
    bloqueVente: true,
    sortStock: true,
    positionX: 540,
    positionY: 200,
  },
  {
    nom: 'Retiré',
    couleur: '#ef4444',
    estDefaut: false,
    estVente: false,
    bloqueVente: true,
    sortStock: true,
    positionX: 540,
    positionY: 320,
  },
] as const;

/**
 * Transitions de base, par nom de statut.
 *
 * « Vendu » repart vers « En rayon » : un retour client se remet en vente. Les
 * deux statuts bloquants sont des points d'arrivée — un article rendu ou retiré
 * n'a plus de suite, ce que le flag `bloqueVente` verrouille de toute façon.
 */
export const TRANSITIONS_DE_BASE: [string, string][] = [
  ['En stock', 'En rayon'],
  ['En stock', 'Réservé'],
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
