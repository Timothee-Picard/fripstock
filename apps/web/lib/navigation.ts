import type { Permission } from './types';

/** Nom du cookie qui retient le menu replié. Lu au rendu serveur. */
export const SIDEBAR_COOKIE = 'fripstock_sidebar';

/**
 * Clé de l'icône d'une section.
 *
 * Une chaîne et non le composant lui-même : ces entrées traversent la
 * frontière serveur → client, qui ne laisse passer que des données.
 */
export type NavIcon =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'attributes'
  | 'statuses'
  | 'depositors'
  | 'contracts'
  | 'shops'
  | 'users';

export interface NavEntry {
  href: string;
  label: string;
  icon: NavIcon;
  permission?: Permission;
  manager?: boolean;
}

/**
 * Entrées du menu, avec la permission qu'elles supposent.
 *
 * On ne propose pas un lien que l'API refusera : la permission est vérifiée
 * côté serveur de toute façon, mais offrir une porte fermée n'aide personne.
 *
 * « Mon profil » n'y figure pas : on y va en cliquant sur son nom, en tête du
 * menu — une entrée de plus n'aurait fait que dire deux fois la même chose.
 */
export const NAVIGATION: NavEntry[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: 'dashboard' },
  {
    href: '/dashboard/products',
    label: 'Produits',
    icon: 'products',
    permission: 'products.view',
  },
  { href: '/dashboard/categories', label: 'Catégories', icon: 'categories' },
  { href: '/dashboard/attributes', label: 'Attributs', icon: 'attributes' },
  { href: '/dashboard/statuses', label: 'Statuts', icon: 'statuses' },
  {
    href: '/dashboard/depositors',
    label: 'Clients déposants',
    icon: 'depositors',
    permission: 'depositors.manage',
  },
  {
    href: '/dashboard/deposit-contracts',
    label: 'Contrats de dépôt',
    icon: 'contracts',
    permission: 'deposits.manage',
  },
  { href: '/dashboard/shops', label: 'Boutiques', icon: 'shops' },
  { href: '/dashboard/users', label: 'Utilisateurs', icon: 'users', manager: true },
];
