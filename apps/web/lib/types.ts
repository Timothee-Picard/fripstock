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
