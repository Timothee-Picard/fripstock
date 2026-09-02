/**
 * Catalogue posé à la création d'une entreprise : attributs et catégories.
 *
 * Un compte neuf arrivait jusqu'ici sur un catalogue vide, et le premier écran
 * utile — créer un produit — exigeait d'aller d'abord inventer une catégorie
 * puis ses attributs. Une friperie vend des robes, des pantalons et des sacs :
 * autant les poser, quitte à ce que le gérant renomme ou supprime.
 *
 * Ces listes servent **trois** usages, et c'est la raison de ce fichier :
 * la bibliothèque globale de templates (seed), le catalogue de l'entreprise de
 * démonstration (seed) et celui de toute entreprise créée par l'inscription.
 * Trois copies auraient dérivé.
 *
 * Contrairement aux statuts, rien n'est figé ici : ajouter une entrée n'appelle
 * aucune migration de données, les entreprises existantes gardent le catalogue
 * qu'elles se sont fait.
 */
import type { AttributeType } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';

export interface AttributeDefault {
  name: string;
  type: AttributeType;
  options: string[];
}

/**
 * Les attributs de base. Ce sont aussi, nom pour nom, les templates de la
 * bibliothèque globale : l'inscription y rattache ses clones quand la
 * bibliothèque est seedée, et s'en passe sinon (en production, seules les
 * migrations tournent).
 */
export const BASE_ATTRIBUTES: AttributeDefault[] = [
  { name: 'Taille', type: 'SELECT', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  {
    name: 'Couleur',
    type: 'SELECT',
    options: ['Noir', 'Blanc', 'Gris', 'Bleu', 'Rouge', 'Vert', 'Beige', 'Multicolore'],
  },
  {
    name: 'Matière',
    type: 'SELECT',
    options: ['Coton', 'Laine', 'Cuir', 'Jean', 'Lin', 'Synthétique'],
  },
  { name: 'Marque', type: 'TEXT', options: [] },
  // Choix multiples : un même article sert plusieurs occasions. C'est le seul
  // attribut dont une valeur ne s'exclut pas des autres, et donc le seul qui
  // fasse compter un article dans plusieurs lignes du classement.
  {
    name: 'Occasion',
    type: 'MULTISELECT',
    options: ['Quotidien', 'Travail', 'Soirée', 'Cérémonie', 'Sport'],
  },
  { name: 'Motif', type: 'SELECT', options: ['Uni', 'Rayé', 'Fleuri', 'À carreaux', 'Imprimé'] },
  // Un nombre et un oui/non : ni l'un ni l'autre ne se classe dans les modules
  // du tableau de bord, qui ne rangent que les listes et le texte libre.
  { name: 'Pointure', type: 'NUMBER', options: [] },
  { name: 'Doublé', type: 'BOOLEAN', options: [] },
];

/** Le rattachement des attributs vaut autant que les catégories : un sac n'a pas de taille. */
const CLOTHING = ['Taille', 'Couleur', 'Matière', 'Marque', 'Occasion', 'Motif'];

/**
 * Catégories de base, sous une racine « Vêtements » sauf celles qui n'en sont
 * pas. L'arbre reste volontairement à deux niveaux : c'est un point de départ à
 * remanier, pas une nomenclature.
 */
export const CATEGORY_ROOT = 'Vêtements';

export interface CategoryDefault {
  name: string;
  /** `false` pour une catégorie qui reste à la racine. */
  underRoot: boolean;
  attributes: string[];
}

export const BASE_CATEGORIES: CategoryDefault[] = [
  { name: 'Robe', underRoot: true, attributes: CLOTHING },
  { name: 'Haut', underRoot: true, attributes: CLOTHING },
  { name: 'Chemise', underRoot: true, attributes: CLOTHING },
  { name: 'Pantalon', underRoot: true, attributes: CLOTHING },
  { name: 'Manteau', underRoot: true, attributes: [...CLOTHING, 'Doublé'] },
  // Une pointure plutôt qu'une taille, et pas de motif : chaque catégorie
  // n'emporte que les attributs qui la concernent.
  {
    name: 'Chaussures',
    underRoot: true,
    attributes: ['Taille', 'Couleur', 'Marque', 'Occasion', 'Pointure'],
  },
  {
    name: 'Sac',
    underRoot: false,
    attributes: ['Couleur', 'Matière', 'Marque', 'Occasion', 'Motif'],
  },
  {
    name: 'Accessoire',
    underRoot: false,
    attributes: ['Couleur', 'Matière', 'Marque', 'Occasion'],
  },
];

/**
 * Pose le catalogue de départ d'une entreprise neuve.
 *
 * À appeler **dans la transaction** de création : un catalogue à moitié écrit
 * serait pire que pas de catalogue, l'entreprise n'ayant aucun écran pour
 * réparer un attribut sans ses options.
 *
 * Les clones sont rattachés à leur template (`clonedFromTemplateId`) quand la
 * bibliothèque existe — c'est ce lien qui distingue plus tard un attribut cloné
 * d'un attribut maison. Elle n'existe que si le seed a tourné : en production
 * seules les migrations le font, et le catalogue se pose alors sans lien, ce qui
 * ne change rien à son usage.
 */
export async function createBaseCatalog(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  const templates = await tx.attributeTemplate.findMany({
    where: { name: { in: BASE_ATTRIBUTES.map((a) => a.name) } },
    select: { id: true, name: true },
  });
  const templateByName = new Map(templates.map((t) => [t.name, t.id]));

  const attributeIds = new Map<string, string>();
  for (const base of BASE_ATTRIBUTES) {
    const attribute = await tx.attributeDefinition.create({
      data: {
        companyId,
        name: base.name,
        type: base.type,
        clonedFromTemplateId: templateByName.get(base.name) ?? null,
        options: {
          create: base.options.map((value, position) => ({ value, position })),
        },
      },
      select: { id: true },
    });
    attributeIds.set(base.name, attribute.id);
  }

  const root = await tx.category.create({
    data: { companyId, name: CATEGORY_ROOT },
    select: { id: true },
  });

  for (const base of BASE_CATEGORIES) {
    await tx.category.create({
      data: {
        companyId,
        name: base.name,
        parentId: base.underRoot ? root.id : null,
        attributes: {
          create: base.attributes.map((name) => ({
            attributeDefinitionId: attributeIds.get(name)!,
          })),
        },
      },
    });
  }
}
