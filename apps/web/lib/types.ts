export const PERMISSIONS = [
  'produits.voir',
  'produits.creer',
  'produits.modifier',
  'produits.supprimer',
  'produits.changerStatut',
  'categories.gerer',
  'attributs.gerer',
  'clients.gerer',
  'depots.gerer',
  'stats.voir',
  'export.csv',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Libellés lisibles, pour ne pas afficher les clés techniques au gérant. */
export const LIBELLES_PERMISSIONS: Record<Permission, string> = {
  'produits.voir': 'Voir les produits',
  'produits.creer': 'Créer des produits',
  'produits.modifier': 'Modifier des produits',
  'produits.supprimer': 'Supprimer des produits',
  'produits.changerStatut': 'Changer le statut',
  'categories.gerer': 'Gérer les catégories',
  'attributs.gerer': 'Gérer les attributs',
  'clients.gerer': 'Gérer les déposants',
  'depots.gerer': 'Gérer les dépôts',
  'stats.voir': 'Voir les statistiques',
  'export.csv': 'Exporter en CSV',
};

export interface AccesBoutique {
  boutiqueId: string;
  nom: string;
  tousDroits: boolean;
  permissions: Permission[];
}

export interface Session {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  estGerant: boolean;
  entreprise: { id: string; nom: string };
  boutiques: AccesBoutique[];
}

export interface Boutique {
  id: string;
  nom: string;
  adresse: string | null;
  createdAt: string;
}

export interface Employe {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  estGerant: boolean;
  createdAt: string;
  acces: {
    boutiqueId: string;
    permissions: Record<string, boolean>;
    boutique: { nom: string };
  }[];
}

export type TypeAttribut = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN';

export const LIBELLES_TYPES: Record<TypeAttribut, string> = {
  TEXT: 'Texte libre',
  NUMBER: 'Nombre',
  SELECT: 'Choix unique',
  MULTISELECT: 'Choix multiples',
  BOOLEAN: 'Oui / non',
};

/** Seuls ces types portent une liste d'options. */
export const TYPES_A_OPTIONS: TypeAttribut[] = ['SELECT', 'MULTISELECT'];

export interface Categorie {
  id: string;
  nom: string;
  parentId: string | null;
  createdAt: string;
}

export interface CategorieArbre {
  id: string;
  nom: string;
  parentId: string | null;
  enfants: CategorieArbre[];
}

export interface AttributOption {
  id: string;
  valeur: string;
  ordre: number;
}

export interface AttributDefinition {
  id: string;
  nom: string;
  type: TypeAttribut;
  clonedFromTemplateId: string | null;
  options: AttributOption[];
  categories: { categorieId: string }[];
}

export interface AttributTemplate {
  id: string;
  nom: string;
  type: TypeAttribut;
  options: { id: string; valeur: string; ordre: number }[];
}

/** Aplatit l'arbre en libellés indentés, pour les listes déroulantes. */
export function aplatirArbre(
  noeuds: CategorieArbre[],
  profondeur = 0,
): { id: string; libelle: string }[] {
  return noeuds.flatMap((n) => [
    {
      id: n.id,
      libelle: `${'\u00a0\u00a0'.repeat(profondeur)}${profondeur > 0 ? '└ ' : ''}${n.nom}`,
    },
    ...aplatirArbre(n.enfants, profondeur + 1),
  ]);
}

export type TypeVente = 'ACHAT_REVENTE' | 'DEPOT_VENTE';

export const LIBELLES_TYPE_VENTE: Record<TypeVente, string> = {
  ACHAT_REVENTE: 'Achat-revente',
  DEPOT_VENTE: 'Dépôt-vente',
};

export interface Statut {
  id: string;
  nom: string;
  couleur: string;
  ordre: number;
  estDefaut: boolean;
  estVente: boolean;
  bloqueVente: boolean;
  sortStock: boolean;
  positionX: number | null;
  positionY: number | null;
  /** `false` tant qu'aucune flèche n'est tracée : tout est alors permis. */
  fluxDefini: boolean;
  /** Statuts atteignables depuis celui-ci. */
  ciblesAutorisees: string[];
}

export interface ProduitResume {
  id: string;
  reference: string | null;
  nom: string;
  photoUrl: string | null;
  prixVente: string | null;
  prixVendu: string | null;
  quantite: number;
  typeVente: TypeVente;
  dateVente: string | null;
  createdAt: string;
  categorie: { id: string; nom: string };
  boutique: { id: string; nom: string } | null;
  statut: Statut;
}

export interface ValeurProduit {
  attributDefinitionId: string;
  valeurTexte: string | null;
  valeurNombre: string | null;
  valeurBooleenne: boolean | null;
  attribut: { id: string; nom: string; type: TypeAttribut };
}

export interface OptionProduit {
  option: {
    id: string;
    valeur: string;
    attribut: { id: string; nom: string; type: TypeAttribut };
  };
}

export interface Produit extends ProduitResume {
  description: string | null;
  commentaire: string | null;
  prixAchat: string | null;
  commissionAppliquee: string | null;
  deposantPaye: boolean | null;
  contratDepotId: string | null;
  valeurs: ValeurProduit[];
  options: OptionProduit[];
  historique: {
    id: string;
    changedAt: string;
    note: string | null;
    statut: { id: string; nom: string; couleur: string };
    auteur: { id: string; prenom: string; nom: string } | null;
  }[];
}

export interface PageProduits {
  produits: ProduitResume[];
  total: number;
  page: number;
  parPage: number;
  pages: number;
}

/** Regroupe les valeurs d'un produit en couples lisibles, options comprises. */
export function attributsLisibles(produit: Produit): { nom: string; valeur: string }[] {
  const parNom = new Map<string, string[]>();

  for (const v of produit.valeurs) {
    const brut =
      v.valeurTexte ??
      v.valeurNombre ??
      (v.valeurBooleenne === null ? null : v.valeurBooleenne ? 'Oui' : 'Non');
    if (brut !== null) parNom.set(v.attribut.nom, [String(brut)]);
  }
  for (const o of produit.options) {
    const liste = parNom.get(o.option.attribut.nom) ?? [];
    liste.push(o.option.valeur);
    parNom.set(o.option.attribut.nom, liste);
  }

  return [...parNom.entries()]
    .map(([nom, valeurs]) => ({ nom, valeur: valeurs.join(', ') }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

/** Prix formatés en euros, avec les décimales renvoyées par l'API. */
export function euros(montant: string | null): string {
  if (montant === null) return '—';
  return `${Number(montant).toFixed(2).replace('.', ',')} €`;
}

export type StatutContrat = 'ACTIF' | 'EXPIRE' | 'CLOS';

export const LIBELLES_STATUT_CONTRAT: Record<StatutContrat, string> = {
  ACTIF: 'Actif',
  EXPIRE: 'Expiré',
  CLOS: 'Clos',
};

export interface ClientDeposant {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  iban: string | null;
  commissionDefaut: string;
  createdAt: string;
  _count?: { contrats: number };
}

export interface ContratDepot {
  id: string;
  clientId: string;
  dateDebut: string;
  dateFin: string;
  commission: string;
  notifyBeforeDays: number;
  statut: StatutContrat;
  notifieLe: string | null;
  client: { id: string; nom: string; prenom: string | null; commissionDefaut: string };
  _count: { produits: number };
  produits?: ProduitResume[];
}

export interface LigneReleve {
  produitId: string;
  reference: string | null;
  nom: string;
  dateVente: string | null;
  statut: { id: string; nom: string; couleur: string };
  prixVendu: number;
  commission: number;
  partBoutique: number;
  partDeposant: number;
  deposantPaye: boolean;
}

export interface Releve {
  client: {
    id: string;
    nom: string;
    prenom: string | null;
    iban: string | null;
    commissionDefaut: string;
  };
  lignes: LigneReleve[];
  totaux: {
    produitsVendus: number;
    totalVendu: number;
    partBoutique: number;
    partDeposant: number;
    dejaPaye: number;
    restantDu: number;
  };
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  contratDepotId: string | null;
  contratDepot: {
    id: string;
    dateFin: string;
    client: { id: string; nom: string; prenom: string | null };
  } | null;
}

export interface Notifications {
  notifications: Notification[];
  nonLues: number;
}

/** Montant en euros, à partir d'un nombre déjà arrondi par l'API. */
export function eurosNombre(montant: number): string {
  return `${montant.toFixed(2).replace('.', ',')} €`;
}

/** Nombre de jours restants avant une échéance — négatif si dépassée. */
export function joursAvant(date: string): number {
  const fin = new Date(date);
  const maintenant = new Date();
  return Math.ceil((fin.getTime() - maintenant.getTime()) / 86400000);
}

export interface TableauDeBord {
  periode: { du: string; au: string };
  ventes: { nombre: number; chiffreAffaires: number; marge: number; panierMoyen: number };
  parJour: { jour: string; ca: number; nombre: number }[];
  topCategories: { id: string; nom: string; ca: number; nombre: number }[];
  topProduits: { id: string; nom: string; reference: string | null; ca: number }[];
  stock: {
    parStatut: {
      id: string;
      nom: string;
      couleur: string;
      sortStock: boolean;
      nombre: number;
      valeur: number;
    }[];
    actifs: number;
    valeurActive: number;
  };
  retours: { depotSurPeriode: number; rendus: number; taux: number };
}
