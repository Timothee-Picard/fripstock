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
