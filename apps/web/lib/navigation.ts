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
  | 'depositors'
  | 'contracts'
  | 'removals'
  | 'shops'
  | 'users';

export interface NavEntry {
  href: string;
  label: string;
  icon: NavIcon;
  permission?: Permission;
  /** L'un **ou** l'autre suffit, quand deux métiers ouvrent le même écran. */
  anyPermission?: Permission[];
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
  {
    // Deux métiers y viennent : celui qui dépublie les annonces et celui qui
    // décroche les vêtements. Chacun n'y verra que sa moitié.
    href: '/dashboard/removals',
    label: 'Retraits à faire',
    icon: 'removals',
    anyPermission: ['online.manage', 'products.manage'],
  },
  { href: '/dashboard/shops', label: 'Boutiques', icon: 'shops' },
  { href: '/dashboard/users', label: 'Utilisateurs', icon: 'users', manager: true },
];

/** Écrans hors menu qui méritent quand même un titre dans l'en-tête. */
const HORS_MENU: { href: string; label: string }[] = [
  { href: '/dashboard/profile', label: 'Mon profil' },
];

/**
 * Titre de l'écran courant, pour l'en-tête.
 *
 * Le préfixe le plus long gagne : `/dashboard` préfixe toutes les routes, et
 * sans cette règle chaque écran s'appellerait « Tableau de bord ».
 *
 * On s'arrête volontairement à la **section**. Une sous-page garde son propre
 * titre, plus précis, et l'en-tête dit alors d'où elle vient — « Produits »
 * au-dessus de « Nouveau produit ». Nommer ici chaque sous-route obligerait à
 * tenir une seconde table des routes, qui dériverait de la vraie.
 */
export function sectionTitle(pathname: string): string | null {
  const candidats = [...NAVIGATION, ...HORS_MENU].filter(
    (e) => pathname === e.href || pathname.startsWith(`${e.href}/`),
  );
  if (candidats.length === 0) return null;
  return candidats.reduce((a, b) => (b.href.length > a.href.length ? b : a)).label;
}
