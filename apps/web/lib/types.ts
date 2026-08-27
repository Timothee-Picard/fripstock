export const PERMISSIONS = [
  'products.view',
  'products.create',
  'products.update',
  'products.delete',
  'products.changeStatus',
  'categories.manage',
  'attributes.manage',
  'depositors.manage',
  'deposits.manage',
  'stats.view',
  'export.csv',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Libellés lisibles, pour ne pas afficher les clés techniques au gérant. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'products.view': 'Voir les produits',
  'products.create': 'Créer des produits',
  'products.update': 'Modifier des produits',
  'products.delete': 'Supprimer des produits',
  'products.changeStatus': 'Changer le statut',
  'categories.manage': 'Gérer les catégories',
  'attributes.manage': 'Gérer les attributs',
  'depositors.manage': 'Gérer les déposants',
  'deposits.manage': 'Gérer les dépôts',
  'stats.view': 'Voir les statistiques',
  'export.csv': 'Exporter en CSV',
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

export interface Dashboard {
  period: { from: string; to: string };
  sales: { count: number; revenue: number; margin: number; averageBasket: number };
  byDay: { day: string; revenue: number; count: number }[];
  topCategories: { id: string; name: string; revenue: number; count: number }[];
  topProducts: { id: string; name: string; reference: string | null; revenue: number }[];
  stock: {
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
  returns: { consignmentOverPeriod: number; returned: number; rate: number };
}
