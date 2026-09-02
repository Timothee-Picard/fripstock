/** Colonnes triables de la liste produits. Miroir de `PRODUCT_SORTS` côté API. */
export const PRODUCT_SORTS = [
  'createdAt',
  'reference',
  'name',
  'salePrice',
  'soldPrice',
  'soldAt',
  'status',
  'category',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * Canal « boutique en ligne » du tableau de bord (`?channel=online`).
 *
 * Ici et non dans `shop-selector.tsx` : un composant serveur ne peut pas
 * importer une valeur d'un module `'use client'`. Next en fait une référence
 * client, la comparaison échoue **sans erreur**, et le tableau de bord retombe
 * silencieusement sur les boutiques physiques. C'est arrivé.
 */
export const ONLINE_CHANNEL = 'online';

export const PERMISSIONS = [
  'products.view',
  'products.manage',
  'products.delete',
  'products.changeStatus',
  'online.manage',
  'categories.manage',
  'attributes.manage',
  'depositors.manage',
  'deposits.manage',
  'stats.view',
  'stock.view',
  'export.csv',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Droits qui portent sur l'**entreprise**, pas sur une boutique.
 *
 * Miroir de `COMPANY_PERMISSIONS` côté API — à tenir aligné. Le catalogue, les
 * déposants, les contrats et le site sont uniques : les cocher une fois les
 * accorde partout, et l'écran des accès doit le montrer plutôt que de les
 * répéter boutique par boutique.
 */
export const COMPANY_PERMISSIONS: readonly Permission[] = [
  'categories.manage',
  'attributes.manage',
  'depositors.manage',
  'deposits.manage',
  'online.manage',
];

/** Les autres : ils se règlent boutique par boutique. */
export const SHOP_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) => !COMPANY_PERMISSIONS.includes(p),
);

/** Libellés lisibles, pour ne pas afficher les clés techniques au gérant. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'products.view': 'Voir les produits',
  'products.manage': 'Créer et modifier des produits',
  'products.delete': 'Supprimer des produits',
  'products.changeStatus': 'Vendre et changer le statut',
  'online.manage': 'Gérer la vente en ligne',
  'categories.manage': 'Gérer les catégories',
  'attributes.manage': 'Gérer les attributs',
  'depositors.manage': 'Gérer les déposants',
  'deposits.manage': 'Gérer les contrats de dépôt',
  'stats.view': 'Voir les chiffres de vente',
  'stock.view': "Voir l'état du stock",
  'export.csv': 'Exporter en CSV',
};

/**
 * Ce que chaque droit ouvre réellement, en une phrase.
 *
 * Le libellé seul ne suffit pas : « Changer le statut » ne dit pas qu'il s'agit
 * de la vente, et le gérant qui coche des cases doit savoir ce qu'il accorde.
 */
export const PERMISSION_HINTS: Record<Permission, string> = {
  'products.view': 'Consulter la liste et les fiches produit.',
  'products.manage': 'Créer un article, un lot, et corriger une fiche existante.',
  'products.delete': 'Effacer un article définitivement.',
  'products.changeStatus':
    "Encaisser une vente au comptoir, et déplacer un article d'un statut à l'autre.",
  'online.manage':
    'Mettre un article en vente sur le site, fixer son prix en ligne, et enregistrer une vente en ligne. Ce droit seul ne permet ni de modifier le vêtement, ni de vendre au comptoir.',
  'categories.manage': "Ajouter et réorganiser l'arborescence des catégories.",
  'attributes.manage': 'Définir les attributs (taille, couleur…) et leurs options.',
  'depositors.manage': 'Créer et modifier les fiches des clients déposants.',
  'deposits.manage':
    "Ouvrir un contrat de dépôt, y rattacher des articles, régler les déposants. Ouvrir un contrat demande en plus « Créer et modifier des produits », puisqu'il enregistre les articles déposés.",
  'stats.view': "Chiffre d'affaires, marge, panier moyen, taux de retour.",
  'stock.view': 'Nombre et valeur des articles en boutique, répartition par statut.',
  'export.csv': 'Télécharger le stock au format tableur.',
};

export interface ShopAccess {
  shopId: string;
  name: string;
  allRights: boolean;
  permissions: Permission[];
}

export interface Session {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isManager: boolean;
  company: { id: string; name: string };
  shops: ShopAccess[];
}

/**
 * Ce que la suppression du compte emporterait (`GET /auth/account`).
 *
 * Les chiffres sont là pour que la confirmation soit lisible : « supprimer
 * définitivement » ne dit pas ce qu'on perd, « 3 boutiques et 128 produits » si.
 */
export interface AccountSummary {
  companyName: string;
  shops: number;
  employees: number;
  products: number;
  depositors: number;
  contracts: number;
}

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isManager: boolean;
  createdAt: string;
  accesses: {
    shopId: string;
    permissions: Record<string, boolean>;
    shop: { name: string };
  }[];
}

export type AttributeType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN';

export const TYPE_LABELS: Record<AttributeType, string> = {
  TEXT: 'Texte libre',
  NUMBER: 'Nombre',
  SELECT: 'Choix unique',
  MULTISELECT: 'Choix multiples',
  BOOLEAN: 'Oui / non',
};

/** Seuls ces types portent une liste d'options. */
export const TYPES_WITH_OPTIONS: AttributeType[] = ['SELECT', 'MULTISELECT'];

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface CategoryTree {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryTree[];
}

export interface AttributeOption {
  id: string;
  value: string;
  position: number;
}

export interface AttributeDefinition {
  id: string;
  name: string;
  type: AttributeType;
  clonedFromTemplateId: string | null;
  options: AttributeOption[];
  categories: { categoryId: string }[];
}

export interface AttributeTemplate {
  id: string;
  name: string;
  type: AttributeType;
  options: { id: string; value: string; position: number }[];
}

/** Aplatit l'arbre en libellés indentés, pour les listes déroulantes. */
export function flattenTree(nodes: CategoryTree[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((n) => [
    {
      id: n.id,
      // Espaces insécables : dans une <option>, des espaces ordinaires seraient
      // repliés par le navigateur et l'indentation disparaîtrait.
      label: `${'  '.repeat(depth)}${depth > 0 ? '└ ' : ''}${n.name}`,
    },
    ...flattenTree(n.children, depth + 1),
  ]);
}

export type SaleType = 'RESALE' | 'CONSIGNMENT';

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  RESALE: 'Achat-revente',
  CONSIGNMENT: 'Dépôt-vente',
};

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSale: boolean;
  blocksSale: boolean;
  leavesStock: boolean;
  /** Vente passée par le site plutôt qu'au comptoir. */
  isOnlineSale: boolean;
  positionX: number | null;
  positionY: number | null;
  /** `false` tant qu'aucune flèche n'est tracée : tout est alors permis. */
  flowDefined: boolean;
  /** Statuts atteignables depuis celui-ci. */
  allowedTargets: string[];
}

export interface ProductSummary {
  id: string;
  reference: string | null;
  name: string;
  photoUrl: string | null;
  salePrice: string | null;
  soldPrice: string | null;
  quantity: number;
  saleType: SaleType;
  soldAt: string | null;
  /** Annoncé sur le site. Indépendant du statut : les deux coexistent. */
  isOnline: boolean;
  /** Prix affiché en ligne. `null` : le site reprend `salePrice`. */
  onlinePrice: string | null;
  /** Vendu ici, encore présent là — il reste un retrait à faire sur l'autre canal. */
  pendingRemoval: boolean;
  createdAt: string;
  /** Contrat de dépôt qui le porte, s'il y en a un. Un produit n'en a qu'un. */
  depositContractId: string | null;
  category: { id: string; name: string };
  shop: { id: string; name: string } | null;
  status: Status;
}

export interface ProductAttributeValue {
  attributeDefinitionId: string;
  textValue: string | null;
  numberValue: string | null;
  booleanValue: boolean | null;
  attribute: { id: string; name: string; type: AttributeType };
}

export interface ProductAttributeOption {
  option: {
    id: string;
    value: string;
    attribute: { id: string; name: string; type: AttributeType };
  };
}

export interface Product extends ProductSummary {
  description: string | null;
  internalNote: string | null;
  purchasePrice: string | null;
  appliedCommission: string | null;
  depositorPaid: boolean | null;
  depositContractId: string | null;
  attributeValues: ProductAttributeValue[];
  attributeOptions: ProductAttributeOption[];
  statusHistory: {
    id: string;
    changedAt: string;
    note: string | null;
    status: { id: string; name: string; color: string };
    author: { id: string; firstName: string; lastName: string } | null;
  }[];
}

export interface ProductPage {
  products: ProductSummary[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

/** Regroupe les valeurs d'un produit en couples lisibles, options comprises. */
export function readableAttributes(product: Product): { name: string; value: string }[] {
  const byName = new Map<string, string[]>();

  for (const v of product.attributeValues) {
    const raw =
      v.textValue ??
      v.numberValue ??
      (v.booleanValue === null ? null : v.booleanValue ? 'Oui' : 'Non');
    if (raw !== null) byName.set(v.attribute.name, [String(raw)]);
  }
  for (const o of product.attributeOptions) {
    const list = byName.get(o.option.attribute.name) ?? [];
    list.push(o.option.value);
    byName.set(o.option.attribute.name, list);
  }

  return [...byName.entries()]
    .map(([name, values]) => ({ name, value: values.join(', ') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Prix formatés en euros, avec les décimales renvoyées par l'API. */
export function euros(amount: string | null): string {
  if (amount === null) return '—';
  return `${Number(amount).toFixed(2).replace('.', ',')} €`;
}

export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'CLOSED';

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: 'Actif',
  EXPIRED: 'Expiré',
  CLOSED: 'Clos',
};

export interface Depositor {
  id: string;
  lastName: string;
  /** Code court repris dans les références de ses articles (le MAR de D-MAR-001). */
  code: string | null;
  firstName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  iban: string | null;
  defaultCommission: string;
  createdAt: string;
  _count?: { contracts: number };
}

export interface DepositContract {
  id: string;
  depositorId: string;
  startDate: string;
  endDate: string;
  commission: string;
  notifyBeforeDays: number;
  status: ContractStatus;
  notifiedAt: string | null;
  depositor: {
    id: string;
    lastName: string;
    firstName: string | null;
    code: string | null;
    defaultCommission: string;
  };
  _count: { products: number };
  products?: ProductSummary[];
}

export interface StatementLine {
  productId: string;
  reference: string | null;
  name: string;
  soldAt: string | null;
  status: { id: string; name: string; color: string };
  soldPrice: number;
  commission: number;
  shopShare: number;
  depositorShare: number;
  depositorPaid: boolean;
}

export interface Statement {
  depositor: {
    id: string;
    lastName: string;
    firstName: string | null;
    iban: string | null;
    defaultCommission: string;
  };
  lines: StatementLine[];
  totals: {
    soldCount: number;
    soldTotal: number;
    shopShare: number;
    depositorShare: number;
    alreadyPaid: number;
    outstanding: number;
  };
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  depositContractId: string | null;
  depositContract: {
    id: string;
    endDate: string;
    depositor: { id: string; lastName: string; firstName: string | null };
  } | null;
}

export interface Notifications {
  notifications: Notification[];
  unread: number;
}

/** Montant en euros, à partir d'un nombre déjà arrondi par l'API. */
export function eurosNumber(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

/** Nombre de jours restants avant une échéance — négatif si dépassée. */
export function daysUntil(date: string): number {
  const end = new Date(date);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

/**
 * Tableau de bord.
 *
 * Presque tout y est optionnel : l'API n'envoie que les blocs auxquels
 * l'utilisateur a droit — `stats.view` pour l'argent, `stock.view` pour
 * l'inventaire — plutôt que de tout envoyer et laisser l'interface masquer.
 * Un bloc absent n'est donc pas une erreur, c'est un droit qui manque.
 */
export interface RemovalItem {
  id: string;
  name: string;
  reference: string | null;
  soldAt: string | null;
  shop: { id: string; name: string } | null;
  status: { id: string; name: string; color: string; isOnlineSale: boolean };
}

/**
 * Une liste de retraits, **tronquée**, avec son compte réel.
 *
 * `total` ne se déduit pas de `items.length` : l'API n'en renvoie que les
 * premiers. Afficher la longueur du tableau se lirait comme « il n'en reste que
 * ça », ce qui est faux un lendemain de week-end.
 */
export interface RemovalList {
  items: RemovalItem[];
  total: number;
}

/** Réponse de `GET /products/removals` : la liste entière, bornée, plus le total. */
export interface RemovalPage {
  products: RemovalItem[];
  total: number;
}

export interface Dashboard {
  period: { from: string; to: string };
  /**
   * Journée en cours, indépendante de la période choisie. Ouverte aussi à qui
   * tient le comptoir — mais la marge, elle, reste réservée à `stats.view`.
   */
  today?: {
    date: string /** Jour calendaire AAAA-MM-JJ. */;
    count: number;
    revenue: number;
    margin?: number;
  };
  /**
   * Retraits à faire après une vente, un article présent sur les deux canaux
   * n'étant retiré de l'autre que par quelqu'un.
   *
   * Deux listes et non une : ce ne sont ni les mêmes gestes ni les mêmes
   * personnes. `toDelist` demande « Gérer la vente en ligne », `toPull`
   * « Créer et modifier des produits ». Une liste absente est un droit qui
   * manque, pas une absence de corvée.
   */
  removals?: {
    /** Vendus au comptoir, annonce encore publiée : à dépublier. */
    toDelist?: RemovalList;
    /** Vendus par le site, vêtement encore en boutique : à décrocher. */
    toPull?: RemovalList;
  };
  sales?: { count: number; revenue: number; margin: number; averageBasket: number };
  byDay?: { day: string; revenue: number; count: number }[];
  topCategories?: { id: string; name: string; revenue: number; count: number }[];
  topProducts?: { id: string; name: string; reference: string | null; revenue: number }[];
  /**
   * Temps de rotation : de l'entrée en stock à la vente. La médiane accompagne
   * la moyenne — un manteau resté un an fait mentir la seconde à lui seul.
   *
   * `buckets[].to` à `null` marque la dernière tranche, ouverte.
   */
  rotation?: {
    count: number;
    averageDays: number;
    medianDays: number;
    buckets: { from: number; to: number | null; count: number }[];
  };
  /**
   * Ventes classées par valeur d'attribut : la meilleure couleur, la meilleure
   * marque. Une entrée par attribut classable de l'entreprise, **même sans
   * vente** — sinon la carte disparaîtrait du rangement dès qu'on change de
   * période.
   */
  topAttributes?: {
    id: string;
    name: string;
    type: AttributeType;
    values: { value: string; revenue: number; count: number }[];
  }[];
  stock?: {
    byStatus: {
      id: string;
      name: string;
      color: string;
      leavesStock: boolean;
      count: number;
      value: number;
    }[];
    active: number;
    activeValue: number;
  };
  returns?: { consignmentOverPeriod: number; returned: number; rate: number };
}

/**
 * Rangement des modules du tableau de bord, propre à chaque utilisateur.
 *
 * L'ordre du tableau est l'ordre à l'écran. Une clé inconnue vient d'une
 * version antérieure de l'écran : on l'ignore. Un module absent de la liste n'a
 * jamais été rangé : il se pose à la fin, avec sa visibilité par défaut.
 */
export interface DashboardLayoutEntry {
  key: string;
  visible: boolean;
}

export interface DashboardLayout {
  modules: DashboardLayoutEntry[];
}
