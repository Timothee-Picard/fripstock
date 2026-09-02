/**
 * Fripstock seed.
 *
 * Inserts the global attribute template library, then a complete demo company
 * (manager, shop, catalogue, statuses, depositor, products) so the UI has
 * something to show from the next step onwards.
 *
 * Idempotent: re-running it does not duplicate anything, and it resets the demo
 * accounts — password included — so `make seed` always lands on a known state.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import type { PermissionMap } from '../src/common/permissions';
import { BASE_STATUSES, BASE_TRANSITIONS } from '../src/statuses/statuses.defaults';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { AttributeType, SaleType } from '../src/generated/prisma/enums';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL manquante — le seed doit tourner dans le conteneur api.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) });

const MANAGER_EMAIL = 'gerant@fripstock.test';
const EMPLOYEE_EMAIL = 'employe@fripstock.test';
const DEMO_PASSWORD = 'fripstock';

/**
 * Deliberately partial permissions, and deliberately different from one shop to
 * the next: the demo employee tends the stock here and the till there.
 *
 * That split is the point. He never holds `stats.view`, so the dashboard owes
 * him the day's takings and the state of the stock — never the margin, the
 * revenue or the average basket. A single all-or-nothing account would make
 * that regression invisible.
 */
const DEMO_STOCK_PERMISSIONS: PermissionMap = {
  'products.view': true,
  'products.manage': true,
  'stock.view': true,
};

const DEMO_TILL_PERMISSIONS: PermissionMap = {
  'products.view': true,
  'products.changeStatus': true,
};

/**
 * The web-only role, on a third shop: it may list a garment and record an
 * online sale, and nothing else. Handing it `products.manage` would defeat the
 * point — the split between the two is what the permission exists for.
 */
const DEMO_ONLINE_PERMISSIONS: PermissionMap = {
  'products.view': true,
  'online.manage': true,
};

/** Global library, shared by every company, read-only. */
const TEMPLATES: { name: string; type: AttributeType; options: string[] }[] = [
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
  // Absent des chaussures et des accessoires, et laissé vide sur un article
  // sur quatre : tous les champs ne sont pas toujours saisis, et un classement
  // doit le supporter sans compter de valeur « rien ».
  { name: 'Motif', type: 'SELECT', options: ['Uni', 'Rayé', 'Fleuri', 'À carreaux', 'Imprimé'] },
  // Un nombre et un oui/non : ni l'un ni l'autre ne se classe par chiffre
  // d'affaires — ils sont là pour qu'on vérifie qu'ils n'apparaissent pas dans
  // les modules du tableau de bord.
  { name: 'Pointure', type: 'NUMBER', options: [] },
  { name: 'Doublé', type: 'BOOLEAN', options: [] },
];

/** Which attributes apply to which category: a bag has no size. */
const HABILLEMENT = ['Taille', 'Couleur', 'Matière', 'Marque', 'Occasion', 'Motif'];
const CATEGORIES: { name: string; attributes: string[] }[] = [
  { name: 'Robe', attributes: HABILLEMENT },
  { name: 'Haut', attributes: HABILLEMENT },
  { name: 'Chemise', attributes: HABILLEMENT },
  { name: 'Pantalon', attributes: HABILLEMENT },
  { name: 'Manteau', attributes: [...HABILLEMENT, 'Doublé'] },
  // Une pointure plutôt qu'une taille, et pas de motif : chaque catégorie
  // n'emporte que les attributs qui la concernent.
  { name: 'Chaussures', attributes: ['Taille', 'Couleur', 'Marque', 'Occasion', 'Pointure'] },
  { name: 'Sac', attributes: ['Couleur', 'Matière', 'Marque', 'Occasion', 'Motif'] },
  { name: 'Accessoire', attributes: ['Couleur', 'Matière', 'Marque', 'Occasion'] },
];

/**
 * Dates relatives à l'instant du seed.
 *
 * Une date figée sortirait de la fenêtre par défaut du tableau de bord dès le
 * mois suivant, et les graphiques se retrouveraient vides sur une base fraîche.
 */
function ilYA(jours: number, heure = 14): Date {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  d.setHours(heure, 30, 0, 0);
  return d;
}

function dans(jours: number): Date {
  return ilYA(-jours, 0);
}

const BOUTIQUES = [
  { name: 'Boutique Centre-ville', address: '12 rue des Lilas, Lyon' },
  { name: 'Boutique Gare', address: '3 place de la Gare, Lyon' },
  { name: 'Boutique Marché', address: '48 avenue du Marché, Villeurbanne' },
];

/**
 * Parcours menant à chaque statut, pour l'historique de démonstration.
 *
 * Chaque saut doit exister dans `BASE_TRANSITIONS` : un historique qui montre
 * un passage que l'application refuserait serait un mensonge, et le premier
 * lecteur à le reproduire à la main se heurterait à un refus.
 */
const CHEMINS: Record<string, string[]> = {
  'En stock': ['En stock'],
  'En rayon': ['En stock', 'En rayon'],
  Réservé: ['En stock', 'En rayon', 'Réservé'],
  Vendu: ['En stock', 'En rayon', 'Vendu'],
  'Vendu en ligne': ['En stock', 'En rayon', 'Vendu en ligne'],
  'Rendu au client': ['En stock', 'En rayon', 'Rendu au client'],
  Retiré: ['En stock', 'En rayon', 'Retiré'],
};

const DEPOSANTS = [
  {
    lastName: 'Martin',
    firstName: 'Sophie',
    code: 'MAR',
    email: 'sophie.martin@example.test',
    phone: '0612345678',
    iban: 'FR7630001007941234567890185',
    defaultCommission: 40,
  },
  {
    lastName: 'Durand',
    firstName: 'Jean',
    code: 'DUR',
    email: 'jean.durand@example.test',
    phone: '0623456789',
    iban: 'FR7630004000031234567890143',
    defaultCommission: 50,
  },
  {
    lastName: 'Nguyen',
    firstName: 'Linh',
    code: 'NGU',
    phone: '0634567890',
    defaultCommission: 35,
  },
  {
    lastName: 'Bonnet',
    firstName: 'Claire',
    code: 'BON',
    email: 'claire.bonnet@example.test',
    defaultCommission: 45,
  },
];

/**
 * Contrats de dépôt. Sophie Martin en a deux à la fois — c'est permis, et le
 * relevé du déposant les additionne : ses articles se numérotent D-MAR-001,
 * 002… sans repartir de zéro à chaque contrat.
 */
const CONTRATS = [
  { key: 'martin-ete', depositor: 'Martin', from: 70, to: -25, commission: 40, notify: 7 },
  { key: 'martin-hiver', depositor: 'Martin', from: 10, to: -80, commission: 35, notify: 10 },
  // Échéance dans trois jours : l'alerte doit apparaître sur le tableau de bord.
  { key: 'durand', depositor: 'Durand', from: 40, to: -3, commission: 50, notify: 7 },
  { key: 'nguyen', depositor: 'Nguyen', from: 25, to: -45, commission: 35, notify: 5 },
  // Déjà échu : le job d'échéance doit le passer en EXPIRED.
  { key: 'bonnet', depositor: 'Bonnet', from: 120, to: 10, commission: 45, notify: 7 },
];

async function seedTemplates() {
  for (const template of TEMPLATES) {
    const created = await prisma.attributeTemplate.upsert({
      where: { name: template.name },
      update: { type: template.type },
      create: { name: template.name, type: template.type },
    });
    for (const [position, value] of template.options.entries()) {
      await prisma.attributeTemplateOption.upsert({
        where: { attributeTemplateId_value: { attributeTemplateId: created.id, value } },
        update: { position },
        create: { attributeTemplateId: created.id, value, position },
      });
    }
  }
  console.log(`  ${TEMPLATES.length} templates d'attributs`);
}

async function main() {
  // This seed creates accounts whose credentials are public knowledge. It must
  // never run anywhere but in development.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Le seed crée des comptes de démonstration : refus de tourner avec NODE_ENV=production.',
    );
  }

  console.log('Seed Fripstock');
  await seedTemplates();

  // --- Demo company -------------------------------------------------------
  let company = await prisma.company.findFirst({ where: { name: 'Friperie Démo' } });
  company ??= await prisma.company.create({ data: { name: 'Friperie Démo' } });

  // Demo accounts are reset on every pass, password included: they exist to be
  // tested, changing password among other things. Le rangement du tableau de
  // bord en fait partie : un `make seed` doit rendre l'écran par défaut, sinon
  // la démonstration dépend de ce que la dernière session avait déplacé.
  const manager = await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: {
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName: 'Camille',
      lastName: 'Durand',
      dashboardLayout: Prisma.DbNull,
    },
    create: {
      companyId: company.id,
      email: MANAGER_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName: 'Camille',
      lastName: 'Durand',
      isManager: true,
    },
  });

  const shops = new Map<string, string>();
  for (const b of BOUTIQUES) {
    let boutique = await prisma.shop.findFirst({
      where: { companyId: company.id, name: b.name },
    });
    boutique ??= await prisma.shop.create({ data: { ...b, companyId: company.id } });
    shops.set(b.name, boutique.id);
  }
  console.log(`  ${shops.size} boutiques`);

  // --- Demo employee, with limited rights ---------------------------------
  const employee = await prisma.user.upsert({
    where: { email: EMPLOYEE_EMAIL },
    update: {
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName: 'Théo',
      lastName: 'Bernard',
      dashboardLayout: Prisma.DbNull,
    },
    create: {
      companyId: company.id,
      email: EMPLOYEE_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName: 'Théo',
      lastName: 'Bernard',
      isManager: false,
    },
  });

  // Deux boutiques sur trois, avec des droits différents : la troisième doit
  // rester invisible pour lui, et le stock central lui reste ouvert dès qu'il
  // détient la permission quelque part (voir CLAUDE.md).
  const ACCES_EMPLOYE: { shop: string; permissions: PermissionMap }[] = [
    { shop: BOUTIQUES[0].name, permissions: DEMO_STOCK_PERMISSIONS },
    { shop: BOUTIQUES[1].name, permissions: DEMO_TILL_PERMISSIONS },
    { shop: BOUTIQUES[2].name, permissions: DEMO_ONLINE_PERMISSIONS },
  ];
  for (const acces of ACCES_EMPLOYE) {
    const shopId = shops.get(acces.shop)!;
    await prisma.shopAccess.upsert({
      where: { userId_shopId: { userId: employee.id, shopId } },
      update: { permissions: acces.permissions },
      create: { userId: employee.id, shopId, permissions: acces.permissions },
    });
  }

  // --- Statuses and their flow --------------------------------------------
  const statuses = new Map<string, string>();
  for (const [position, base] of BASE_STATUSES.entries()) {
    const status = await prisma.status.upsert({
      where: { companyId_name: { companyId: company.id, name: base.name } },
      update: { ...base, position },
      create: { ...base, position, companyId: company.id },
    });
    statuses.set(base.name, status.id);
  }

  await prisma.statusTransition.deleteMany({
    where: { source: { companyId: company.id } },
  });
  await prisma.statusTransition.createMany({
    data: BASE_TRANSITIONS.map(([source, target]) => ({
      sourceId: statuses.get(source)!,
      targetId: statuses.get(target)!,
    })),
  });
  console.log(`  ${BASE_STATUSES.length} statuts et ${BASE_TRANSITIONS.length} transitions`);

  // --- Company attributes, cloned from the templates ----------------------
  const attributes = new Map<string, string>();
  for (const template of TEMPLATES) {
    const source = await prisma.attributeTemplate.findUniqueOrThrow({
      where: { name: template.name },
      include: { options: true },
    });
    const attribute = await prisma.attributeDefinition.upsert({
      where: { companyId_name: { companyId: company.id, name: template.name } },
      update: {},
      create: {
        companyId: company.id,
        name: source.name,
        type: source.type,
        clonedFromTemplateId: source.id,
      },
    });
    // The clone copies the template options, then becomes independent.
    for (const option of source.options) {
      await prisma.attributeOption.upsert({
        where: {
          attributeDefinitionId_value: {
            attributeDefinitionId: attribute.id,
            value: option.value,
          },
        },
        update: { position: option.position },
        create: {
          attributeDefinitionId: attribute.id,
          value: option.value,
          position: option.position,
        },
      });
    }
    attributes.set(template.name, attribute.id);
  }
  console.log(`  ${TEMPLATES.length} attributs clonés pour l'entreprise`);

  // --- Categories ---------------------------------------------------------
  const categories = new Map<string, string>();
  let clothing = await prisma.category.findFirst({
    where: { companyId: company.id, name: 'Vêtements' },
  });
  clothing ??= await prisma.category.create({
    data: { companyId: company.id, name: 'Vêtements' },
  });

  for (const entry of CATEGORIES) {
    let category = await prisma.category.findFirst({
      where: { companyId: company.id, name: entry.name },
    });
    category ??= await prisma.category.create({
      data: {
        companyId: company.id,
        name: entry.name,
        // Accessories are not clothing: bags stay at the root.
        parentId: entry.name === 'Sac' ? null : clothing.id,
      },
    });
    categories.set(entry.name, category.id);

    for (const attributeName of entry.attributes) {
      const attributeId = attributes.get(attributeName)!;
      await prisma.categoryAttribute.upsert({
        where: {
          categoryId_attributeDefinitionId: {
            categoryId: category.id,
            attributeDefinitionId: attributeId,
          },
        },
        update: {},
        create: { categoryId: category.id, attributeDefinitionId: attributeId },
      });
    }
  }
  console.log(`  ${CATEGORIES.length + 1} catégories`);

  // --- Depositors and contracts -------------------------------------------
  const depositors = new Map<string, { id: string; code: string; commission: number }>();
  for (const d of DEPOSANTS) {
    let deposant = await prisma.depositor.findFirst({
      where: { companyId: company.id, lastName: d.lastName, firstName: d.firstName },
    });
    deposant ??= await prisma.depositor.create({ data: { ...d, companyId: company.id } });
    depositors.set(d.lastName, {
      id: deposant.id,
      code: d.code,
      commission: d.defaultCommission,
    });
  }
  console.log(`  ${depositors.size} déposants`);

  const contracts = new Map<string, { id: string; commission: number; depositor: string }>();
  for (const c of CONTRATS) {
    const deposant = depositors.get(c.depositor)!;
    let contrat = await prisma.depositContract.findFirst({
      where: { depositorId: deposant.id, startDate: ilYA(c.from, 0) },
    });
    contrat ??= await prisma.depositContract.create({
      data: {
        depositorId: deposant.id,
        startDate: ilYA(c.from, 0),
        endDate: dans(-c.to),
        commission: c.commission,
        notifyBeforeDays: c.notify,
      },
    });
    contracts.set(c.key, {
      id: contrat.id,
      commission: c.commission,
      depositor: c.depositor,
    });
  }
  console.log(`  ${contracts.size} contrats de dépôt (dont deux pour Sophie Martin)`);

  // --- Demo products ------------------------------------------------------
  /**
   * Un stock volontairement varié : les trois boutiques et le stock central,
   * les deux modes de vente, tous les statuts, et des ventes réparties sur les
   * six dernières semaines — dont quelques-unes du jour, pour que le bandeau
   * « Aujourd'hui » et les courbes aient de quoi montrer.
   */
  interface Entree {
    name: string;
    category: string;
    /** Nom de la boutique, ou `null` pour le stock central. */
    shop: string | null;
    status: string;
    contract?: string;
    purchasePrice?: number;
    salePrice: number;
    /** Renseigné pour un article vendu : prix encaissé et ancienneté en jours. */
    soldPrice?: number;
    soldDaysAgo?: number;
    depositorPaid?: boolean;
    /** Public description, shown on the sheet and exported. */
    description?: string;
    /** Internal note: what the shop tells itself, never the customer. */
    note?: string;
    /** Several identical items on one line. Rare in second-hand, but allowed. */
    quantity?: number;
    /** Listed on the online shop. */
    isOnline?: boolean;
    /** Online price, when it differs from the shop label. */
    onlinePrice?: number;
    /** Sold on one channel, still present on the other: a chore to clear. */
    pendingRemoval?: boolean;
    /**
     * Entrée en stock, en jours avant aujourd'hui. À défaut, elle est déduite
     * de la date de vente — voir la création plus bas. Renseignée à la main sur
     * quelques articles pour que le temps de rotation montre ses extrêmes : un
     * article parti en deux jours, un autre resté presque un an.
     */
    stockDaysAgo?: number;
    /** Attributs à choix unique (SELECT). */
    options: Record<string, string>;
    /** Attributs à choix multiples : plusieurs valeurs pour un même attribut. */
    multi?: Record<string, string[]>;
    /** Attributs numériques (la pointure d'une paire de chaussures). */
    numbers?: Record<string, number>;
    /** Attributs oui/non (un manteau doublé ou non). */
    flags?: Record<string, boolean>;
    brand: string;
  }

  const [CV, GA, MA] = BOUTIQUES.map((b) => b.name);

  const products: Entree[] = [
    // --- Achat-revente, en stock ------------------------------------------
    {
      name: 'Robe fleurie été',
      description: 'Robe légère à fleurs, manches courtes, doublée. Coupe évasée.',
      note: 'Petite tache sur l’ourlet arrière, invisible portée.',
      category: 'Robe',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 8,
      salePrice: 25,
      options: { Motif: 'Fleuri', Taille: 'M', Couleur: 'Multicolore', Matière: 'Coton' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      brand: 'Zara',
    },
    {
      name: 'Chemise en lin',
      description: 'Chemise en lin épais, col italien, poche poitrine.',
      category: 'Chemise',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 5,
      salePrice: 18,
      options: { Taille: 'L', Couleur: 'Blanc', Matière: 'Lin' },
      multi: { Occasion: ['Travail'] },
      brand: 'Uniqlo',
    },
    {
      name: 'Jean brut droit',
      description: 'Jean brut coupe droite, taille haute, jamais retouché.',
      note: 'Ourlet à refaire avant mise en rayon.',
      category: 'Pantalon',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 6,
      salePrice: 22,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Bleu', Matière: 'Jean' },
      multi: { Occasion: ['Quotidien'] },
      brand: "Levi's",
    },
    {
      name: 'Pull col rond',
      category: 'Haut',
      shop: GA,
      status: 'En rayon',
      purchasePrice: 4,
      salePrice: 15,
      options: { Motif: 'Imprimé', Taille: 'S', Couleur: 'Gris', Matière: 'Laine' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Monoprix',
    },
    {
      name: 'Manteau laine long',
      description: 'Manteau long en laine mélangée, doublure satin, deux poches passepoilées.',
      category: 'Manteau',
      shop: GA,
      status: 'En rayon',
      purchasePrice: 20,
      salePrice: 65,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Noir', Matière: 'Laine' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      flags: { Doublé: true },
      brand: 'Sandro',
    },
    {
      name: 'Trench beige',
      category: 'Manteau',
      shop: MA,
      status: 'En rayon',
      purchasePrice: 15,
      salePrice: 48,
      options: { Taille: 'L', Couleur: 'Beige', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien'] },
      flags: { Doublé: true },
      brand: 'Burberry',
    },
    {
      name: 'Baskets cuir blanches',
      category: 'Chaussures',
      shop: MA,
      status: 'En rayon',
      purchasePrice: 12,
      salePrice: 35,
      options: { Taille: 'M', Couleur: 'Blanc' },
      multi: { Occasion: ['Travail'] },
      numbers: { Pointure: 37 },
      brand: 'Adidas',
    },
    {
      name: 'Ceinture cuir',
      category: 'Accessoire',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 3,
      salePrice: 12,
      options: { Couleur: 'Noir', Matière: 'Cuir' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Sans marque',
    },
    {
      name: 'Écharpe laine',
      description: 'Écharpe en laine douce, franges nouées main.',
      quantity: 3,
      note: 'Trois écharpes identiques rentrées ensemble. Une ligne, trois pièces.',
      category: 'Accessoire',
      shop: GA,
      status: 'En stock',
      purchasePrice: 2,
      salePrice: 9,
      options: { Couleur: 'Rouge', Matière: 'Laine' },
      multi: { Occasion: ['Cérémonie', 'Soirée'] },
      brand: 'Sans marque',
    },
    {
      name: 'Chemise oversize',
      category: 'Chemise',
      shop: null,
      status: 'En stock',
      purchasePrice: 4,
      salePrice: 16,
      options: { Motif: 'Rayé', Taille: 'XL', Couleur: 'Vert', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Bershka',
    },
    {
      name: 'Robe noire droite',
      category: 'Robe',
      shop: null,
      status: 'En stock',
      purchasePrice: 7,
      salePrice: 24,
      options: { Motif: 'Uni', Taille: 'S', Couleur: 'Noir', Matière: 'Synthétique' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Mango',
    },
    {
      name: 'Sac bandoulière',
      description: 'Sac bandoulière cuir grainé, bandoulière réglable, fermeture aimantée.',
      note: 'Angles légèrement frottés — prix ajusté en conséquence.',
      category: 'Sac',
      shop: null,
      status: 'En stock',
      purchasePrice: 9,
      salePrice: 28,
      options: { Motif: 'Fleuri', Couleur: 'Beige', Matière: 'Cuir' },
      multi: { Occasion: ['Soirée'] },
      brand: 'Lancel',
    },

    // --- Achat-revente, vendus --------------------------------------------
    {
      name: 'Veste en jean',
      category: 'Manteau',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 10,
      salePrice: 32,
      soldPrice: 32,
      soldDaysAgo: 0,
      options: { Taille: 'M', Couleur: 'Bleu', Matière: 'Jean' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      flags: { Doublé: false },
      brand: "Levi's",
    },
    {
      name: 'T-shirt rayé',
      category: 'Haut',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 2,
      stockDaysAgo: 2,
      salePrice: 10,
      soldPrice: 8,
      soldDaysAgo: 0,
      options: { Motif: 'Rayé', Taille: 'S', Couleur: 'Blanc', Matière: 'Coton' },
      multi: { Occasion: ['Travail'] },
      brand: 'Petit Bateau',
    },
    {
      name: 'Bottines cuir',
      category: 'Chaussures',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 14,
      salePrice: 42,
      soldPrice: 42,
      soldDaysAgo: 1,
      options: { Taille: 'M', Couleur: 'Noir' },
      multi: { Occasion: ['Quotidien'] },
      numbers: { Pointure: 36 },
      brand: 'Minelli',
    },
    {
      name: 'Jupe plissée',
      category: 'Robe',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 5,
      salePrice: 19,
      soldPrice: 19,
      soldDaysAgo: 3,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Vert', Matière: 'Synthétique' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Zara',
    },
    {
      name: 'Sweat à capuche',
      category: 'Haut',
      shop: MA,
      status: 'Vendu',
      purchasePrice: 6,
      salePrice: 20,
      soldPrice: 18,
      soldDaysAgo: 6,
      options: { Motif: 'À carreaux', Taille: 'L', Couleur: 'Gris', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien', 'Sport'] },
      brand: 'Nike',
    },
    {
      name: 'Pantalon chino',
      category: 'Pantalon',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 7,
      salePrice: 24,
      soldPrice: 24,
      soldDaysAgo: 9,
      options: { Taille: 'L', Couleur: 'Beige', Matière: 'Coton' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Celio',
    },
    {
      name: 'Blouse fleurie',
      category: 'Chemise',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 4,
      salePrice: 17,
      soldPrice: 15,
      soldDaysAgo: 14,
      options: { Motif: 'Fleuri', Taille: 'S', Couleur: 'Multicolore', Matière: 'Synthétique' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Promod',
    },
    {
      name: 'Cabas toile',
      category: 'Sac',
      shop: MA,
      status: 'Vendu',
      purchasePrice: 3,
      salePrice: 14,
      soldPrice: 14,
      soldDaysAgo: 18,
      options: { Motif: 'Fleuri', Couleur: 'Bleu', Matière: 'Coton' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Sans marque',
    },
    {
      name: 'Doudoune sans manches',
      category: 'Manteau',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 11,
      salePrice: 34,
      soldPrice: 30,
      soldDaysAgo: 24,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Noir', Matière: 'Synthétique' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      flags: { Doublé: true },
      brand: 'Uniqlo',
    },
    {
      name: 'Mocassins daim',
      category: 'Chaussures',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 9,
      stockDaysAgo: 150,
      salePrice: 29,
      soldPrice: 29,
      soldDaysAgo: 31,
      options: { Taille: 'L', Couleur: 'Beige' },
      multi: { Occasion: ['Cérémonie'] },
      numbers: { Pointure: 43 },
      brand: 'Sans marque',
    },

    // --- Dépôt-vente, contrat d'été de Sophie Martin ------------------------
    {
      name: 'Sac à main cuir',
      category: 'Sac',
      shop: CV,
      status: 'En rayon',
      contract: 'martin-ete',
      salePrice: 60,
      options: { Couleur: 'Noir', Matière: 'Cuir' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Lancel',
    },
    {
      name: 'Robe de soirée',
      category: 'Robe',
      shop: CV,
      status: 'Réservé',
      contract: 'martin-ete',
      salePrice: 85,
      options: { Motif: 'Uni', Taille: 'S', Couleur: 'Noir', Matière: 'Synthétique' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      brand: 'Maje',
    },
    {
      name: 'Bottines daim',
      category: 'Chaussures',
      shop: CV,
      status: 'Vendu',
      contract: 'martin-ete',
      salePrice: 45,
      soldPrice: 40,
      soldDaysAgo: 0,
      depositorPaid: false,
      options: { Taille: 'M', Couleur: 'Beige' },
      multi: { Occasion: ['Quotidien', 'Sport'] },
      numbers: { Pointure: 42 },
      brand: 'Minelli',
    },
    {
      name: 'Foulard soie',
      category: 'Accessoire',
      shop: CV,
      status: 'Vendu',
      contract: 'martin-ete',
      salePrice: 30,
      soldPrice: 30,
      soldDaysAgo: 12,
      depositorPaid: true,
      options: { Couleur: 'Rouge', Matière: 'Synthétique' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Hermès',
    },
    {
      name: 'Chemisier blanc',
      category: 'Chemise',
      shop: CV,
      status: 'Rendu au client',
      contract: 'martin-ete',
      salePrice: 22,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Blanc', Matière: 'Coton' },
      multi: { Occasion: ['Travail'] },
      brand: 'Comptoir des Cotonniers',
    },

    // --- Dépôt-vente, second contrat de Sophie Martin -----------------------
    {
      name: 'Manteau camel',
      category: 'Manteau',
      shop: GA,
      status: 'En rayon',
      contract: 'martin-hiver',
      salePrice: 95,
      options: { Motif: 'À carreaux', Taille: 'M', Couleur: 'Beige', Matière: 'Laine' },
      multi: { Occasion: ['Quotidien'] },
      flags: { Doublé: true },
      brand: 'Sézane',
    },
    {
      name: 'Pull cachemire',
      category: 'Haut',
      shop: GA,
      status: 'En rayon',
      contract: 'martin-hiver',
      salePrice: 55,
      options: { Motif: 'Rayé', Taille: 'S', Couleur: 'Gris', Matière: 'Laine' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Eric Bompard',
    },

    // --- Dépôt-vente, Jean Durand (échéance proche) -------------------------
    {
      name: 'Blouson cuir',
      category: 'Manteau',
      shop: GA,
      status: 'En rayon',
      contract: 'durand',
      salePrice: 120,
      options: { Taille: 'L', Couleur: 'Noir', Matière: 'Cuir' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      flags: { Doublé: false },
      brand: 'Schott',
    },
    {
      name: 'Sneakers montantes',
      category: 'Chaussures',
      shop: GA,
      status: 'Vendu',
      contract: 'durand',
      salePrice: 50,
      soldPrice: 45,
      soldDaysAgo: 4,
      depositorPaid: false,
      options: { Taille: 'L', Couleur: 'Blanc' },
      multi: { Occasion: ['Travail'] },
      numbers: { Pointure: 41 },
      brand: 'Converse',
    },
    {
      name: 'Sac à dos toile',
      category: 'Sac',
      shop: GA,
      status: 'En stock',
      contract: 'durand',
      salePrice: 38,
      options: { Motif: 'Fleuri', Couleur: 'Vert', Matière: 'Coton' },
      multi: { Occasion: ['Soirée'] },
      brand: 'Eastpak',
    },

    // --- Dépôt-vente, Linh Nguyen -------------------------------------------
    {
      name: 'Robe portefeuille',
      category: 'Robe',
      shop: MA,
      status: 'En rayon',
      contract: 'nguyen',
      salePrice: 42,
      options: { Motif: 'Imprimé', Taille: 'S', Couleur: 'Bleu', Matière: 'Synthétique' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Ba&sh',
    },
    {
      name: 'Veste tailleur',
      category: 'Manteau',
      shop: MA,
      status: 'Vendu',
      contract: 'nguyen',
      salePrice: 70,
      soldPrice: 65,
      soldDaysAgo: 8,
      depositorPaid: true,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Noir', Matière: 'Laine' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      flags: { Doublé: true },
      brand: 'Claudie Pierlot',
    },
    {
      name: 'Ballerines cuir',
      category: 'Chaussures',
      shop: MA,
      status: 'Retiré',
      contract: 'nguyen',
      salePrice: 28,
      options: { Taille: 'S', Couleur: 'Rouge' },
      multi: { Occasion: ['Quotidien'] },
      numbers: { Pointure: 40 },
      brand: 'Repetto',
    },

    // --- Dépôt-vente, Claire Bonnet (contrat échu) --------------------------
    {
      name: 'Robe vintage',
      category: 'Robe',
      shop: MA,
      status: 'Rendu au client',
      contract: 'bonnet',
      salePrice: 40,
      options: { Motif: 'Imprimé', Taille: 'M', Couleur: 'Multicolore', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Sans marque',
    },
    {
      name: 'Sac vernis',
      category: 'Sac',
      shop: MA,
      status: 'Vendu',
      contract: 'bonnet',
      stockDaysAgo: 320,
      salePrice: 55,
      soldPrice: 50,
      soldDaysAgo: 40,
      depositorPaid: true,
      options: { Couleur: 'Rouge', Matière: 'Synthétique' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Vanessa Bruno',
    },

    // --- Vente en ligne ----------------------------------------------------
    // En fin de liste, et pas ailleurs : les références se calculent dans
    // l'ordre du tableau, un ajout au milieu renumérote tout ce qui suit.
    //
    // Ce bloc couvre les six situations que la fonctionnalité doit rendre
    // lisibles, pour qu'aucune ne se découvre en production :
    //   1. les deux canaux à la fois, prix web plus élevé ;
    //   2. les deux canaux, même prix (onlinePrice vide) ;
    //   3. en ligne depuis le stock central ;
    //   4. vendu au comptoir, annonce encore publiée → à dépublier ;
    //   5. vendu par le site depuis une boutique → à décrocher ;
    //   6. vendu par le site depuis le stock central → aucune corvée.
    {
      name: 'Trench camel ceinturé',
      description: 'Trench mi-long, ceinture d’origine, épaulettes amovibles.',
      note: 'Vendu plus cher en ligne : les frais de port sont inclus dans le prix affiché.',
      category: 'Manteau',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 15,
      salePrice: 45,
      isOnline: true,
      onlinePrice: 52,
      options: { Motif: 'À carreaux', Taille: 'M', Couleur: 'Beige', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien'] },
      flags: { Doublé: true },
      brand: 'Burberry',
    },
    {
      name: 'Pull torsadé écru',
      description: 'Pull grosses torsades, laine mérinos, col rond.',
      category: 'Haut',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 7,
      salePrice: 24,
      isOnline: true,
      options: { Motif: 'Rayé', Taille: 'L', Couleur: 'Beige', Matière: 'Laine' },
      multi: { Occasion: ['Travail'] },
      brand: 'Sézane',
    },
    {
      name: 'Robe cache-cœur verte',
      category: 'Robe',
      shop: GA,
      status: 'En rayon',
      purchasePrice: 9,
      salePrice: 34,
      isOnline: true,
      onlinePrice: 39,
      options: { Motif: 'Uni', Taille: 'S', Couleur: 'Vert', Matière: 'Synthétique' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      brand: 'Maje',
    },
    {
      name: 'Sac seau daim',
      description: 'Sac seau en daim souple, cordon de serrage, intérieur non doublé.',
      note: 'Stock central : à assigner à une boutique si les ventes en ligne ralentissent.',
      category: 'Sac',
      shop: null,
      status: 'En stock',
      purchasePrice: 11,
      salePrice: 38,
      isOnline: true,
      options: { Couleur: 'Beige', Matière: 'Cuir' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Vanessa Bruno',
    },
    {
      name: 'Chemise en jean délavée',
      category: 'Chemise',
      shop: MA,
      status: 'En rayon',
      purchasePrice: 5,
      salePrice: 19,
      isOnline: true,
      options: { Motif: 'À carreaux', Taille: 'M', Couleur: 'Bleu', Matière: 'Jean' },
      multi: { Occasion: ['Quotidien'] },
      brand: "Levi's",
    },
    {
      // Déposé ET en ligne : la commission s'applique quel que soit le canal.
      name: 'Manteau laine bouclée',
      description: 'Manteau court en laine bouclée, coupe droite, sans col.',
      note: 'Dépôt Sophie Martin — contrat hiver, commission 35 %.',
      category: 'Manteau',
      shop: CV,
      status: 'En rayon',
      contract: 'martin-hiver',
      salePrice: 68,
      isOnline: true,
      onlinePrice: 75,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Gris', Matière: 'Laine' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      flags: { Doublé: false },
      brand: 'Sandro',
    },

    // Corvée 1 : vendus au comptoir, annonce encore publiée → à dépublier.
    {
      name: 'Perfecto matelassé',
      category: 'Manteau',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 20,
      salePrice: 75,
      soldPrice: 70,
      soldDaysAgo: 1,
      isOnline: true,
      onlinePrice: 80,
      pendingRemoval: true,
      options: { Motif: 'Uni', Taille: 'L', Couleur: 'Noir', Matière: 'Cuir' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      flags: { Doublé: true },
      brand: 'Schott',
    },
    {
      name: 'Bottines chelsea noires',
      category: 'Chaussures',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 12,
      salePrice: 42,
      soldPrice: 42,
      soldDaysAgo: 3,
      isOnline: true,
      pendingRemoval: true,
      options: { Taille: 'S', Couleur: 'Noir' },
      multi: { Occasion: ['Cérémonie'] },
      numbers: { Pointure: 39 },
      brand: 'Jonak',
    },
    {
      // Déposé, vendu au comptoir, annonce encore en ligne : le relevé du
      // déposant et la corvée cohabitent.
      name: 'Robe longue imprimée',
      category: 'Robe',
      shop: CV,
      status: 'Vendu',
      contract: 'martin-ete',
      stockDaysAgo: 210,
      salePrice: 48,
      soldPrice: 45,
      soldDaysAgo: 2,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'Imprimé', Taille: 'M', Couleur: 'Multicolore', Matière: 'Synthétique' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Ba&sh',
    },

    // Corvée 2 : vendus par le site depuis une boutique → à décrocher.
    // `isOnline` est faux : la vente par le site dépublie l'annonce d'elle-même.
    {
      name: 'Blazer oversize marine',
      category: 'Manteau',
      shop: CV,
      status: 'Vendu en ligne',
      purchasePrice: 14,
      salePrice: 55,
      soldPrice: 55,
      soldDaysAgo: 1,
      pendingRemoval: true,
      options: { Taille: 'L', Couleur: 'Bleu', Matière: 'Laine' },
      multi: { Occasion: ['Quotidien'] },
      flags: { Doublé: true },
      brand: 'Zara',
    },
    {
      name: 'Jupe midi plissée',
      category: 'Pantalon',
      shop: GA,
      status: 'Vendu en ligne',
      purchasePrice: 6,
      salePrice: 26,
      soldPrice: 22,
      soldDaysAgo: 4,
      pendingRemoval: true,
      options: { Motif: 'Rayé', Taille: 'S', Couleur: 'Noir', Matière: 'Synthétique' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Other Stories',
    },

    // Vendus par le site depuis le stock central : aucune corvée, l'article
    // n'était sur aucun portant.
    {
      name: 'Écharpe cachemire grise',
      category: 'Accessoire',
      shop: null,
      status: 'Vendu en ligne',
      purchasePrice: 8,
      salePrice: 30,
      soldPrice: 30,
      soldDaysAgo: 5,
      options: { Couleur: 'Gris', Matière: 'Laine' },
      multi: { Occasion: ['Cérémonie', 'Soirée'] },
      brand: 'Eric Bompard',
    },
    {
      // Dépôt-vente vendu en ligne : la commission se fige comme au comptoir.
      name: 'Sac cabas cuir grainé',
      category: 'Sac',
      shop: null,
      status: 'Vendu en ligne',
      contract: 'nguyen',
      salePrice: 62,
      soldPrice: 58,
      soldDaysAgo: 6,
      depositorPaid: false,
      options: { Motif: 'Uni', Couleur: 'Noir', Matière: 'Cuir' },
      multi: { Occasion: ['Soirée'] },
      brand: 'Polène',
    },
    {
      name: 'Baskets rétro blanches',
      category: 'Chaussures',
      shop: MA,
      status: 'Vendu en ligne',
      purchasePrice: 10,
      salePrice: 36,
      soldPrice: 33,
      soldDaysAgo: 8,
      pendingRemoval: true,
      options: { Taille: 'M', Couleur: 'Blanc' },
      multi: { Occasion: ['Quotidien', 'Sport'] },
      numbers: { Pointure: 38 },
      brand: 'Veja',
    },

    // Volume : au moins dix ventes par le site et dix ventes au comptoir
    // dont l'annonce court encore. En dessous, l'aperçu du tableau de bord —
    // borné à cinq lignes — ne montrerait jamais son « Afficher N de plus »,
    // ni l'écran des retraits sa pagination.
    {
      name: 'Doudoune courte noire',
      category: 'Manteau',
      shop: CV,
      status: 'Vendu en ligne',
      purchasePrice: 16,
      salePrice: 58,
      soldPrice: 55,
      soldDaysAgo: 3,
      pendingRemoval: true,
      options: { Motif: 'Fleuri', Taille: 'M', Couleur: 'Noir', Matière: 'Synthétique' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      flags: { Doublé: false },
      brand: 'Uniqlo',
    },
    {
      name: 'Robe chemise rayée',
      category: 'Robe',
      shop: GA,
      status: 'Vendu en ligne',
      purchasePrice: 7,
      salePrice: 29,
      soldPrice: 29,
      soldDaysAgo: 5,
      pendingRemoval: true,
      options: { Motif: 'Rayé', Taille: 'S', Couleur: 'Bleu', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Sézane',
    },
    {
      name: 'Pantalon velours côtelé',
      category: 'Pantalon',
      shop: CV,
      status: 'Vendu en ligne',
      purchasePrice: 8,
      salePrice: 27,
      soldPrice: 24,
      soldDaysAgo: 7,
      pendingRemoval: true,
      options: { Motif: 'Uni', Taille: 'L', Couleur: 'Vert', Matière: 'Coton' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Bellerose',
    },
    {
      name: 'Chemise oxford bleue',
      category: 'Chemise',
      shop: MA,
      status: 'Vendu en ligne',
      purchasePrice: 5,
      salePrice: 21,
      soldPrice: 21,
      soldDaysAgo: 9,
      pendingRemoval: true,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Bleu', Matière: 'Coton' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Ralph Lauren',
    },
    {
      name: 'Sac banane cuir',
      category: 'Sac',
      shop: null,
      status: 'Vendu en ligne',
      purchasePrice: 9,
      salePrice: 32,
      soldPrice: 30,
      soldDaysAgo: 11,
      options: { Motif: 'À carreaux', Couleur: 'Noir', Matière: 'Cuir' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      brand: 'Sandro',
    },
    {
      name: 'Bottes cavalières',
      category: 'Chaussures',
      shop: GA,
      status: 'Vendu en ligne',
      purchasePrice: 18,
      salePrice: 64,
      soldPrice: 60,
      soldDaysAgo: 13,
      pendingRemoval: true,
      options: { Taille: 'L', Couleur: 'Noir' },
      multi: { Occasion: ['Travail'] },
      numbers: { Pointure: 37 },
      brand: 'Free Lance',
    },
    {
      name: 'Gilet sans manches',
      category: 'Haut',
      shop: CV,
      status: 'Vendu en ligne',
      purchasePrice: 6,
      salePrice: 23,
      soldPrice: 20,
      soldDaysAgo: 15,
      pendingRemoval: true,
      options: { Taille: 'S', Couleur: 'Gris', Matière: 'Laine' },
      multi: { Occasion: ['Quotidien', 'Sport'] },
      brand: 'Comptoir des Cotonniers',
    },
    {
      name: 'Veste tweed chinée',
      category: 'Manteau',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 13,
      salePrice: 49,
      soldPrice: 45,
      soldDaysAgo: 2,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'À carreaux', Taille: 'M', Couleur: 'Gris', Matière: 'Laine' },
      multi: { Occasion: ['Travail', 'Quotidien'] },
      flags: { Doublé: true },
      brand: 'Zadig & Voltaire',
    },
    {
      name: 'Jupe crayon noire',
      category: 'Pantalon',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 5,
      salePrice: 20,
      soldPrice: 20,
      soldDaysAgo: 4,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'Fleuri', Taille: 'S', Couleur: 'Noir', Matière: 'Synthétique' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Claudie Pierlot',
    },
    {
      name: 'Pull col roulé rouge',
      category: 'Haut',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 6,
      salePrice: 24,
      soldPrice: 22,
      soldDaysAgo: 6,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'Uni', Taille: 'L', Couleur: 'Rouge', Matière: 'Laine' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Petit Bateau',
    },
    {
      name: 'Sac seau toile écrue',
      category: 'Sac',
      shop: MA,
      status: 'Vendu',
      purchasePrice: 7,
      salePrice: 26,
      soldPrice: 26,
      soldDaysAgo: 8,
      isOnline: true,
      pendingRemoval: true,
      options: { Couleur: 'Beige', Matière: 'Coton' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Vanessa Bruno',
    },
    {
      name: 'Derbies cuir marron',
      category: 'Chaussures',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 14,
      salePrice: 48,
      soldPrice: 44,
      soldDaysAgo: 10,
      isOnline: true,
      pendingRemoval: true,
      options: { Taille: 'L', Couleur: 'Beige' },
      multi: { Occasion: ['Quotidien'] },
      numbers: { Pointure: 36 },
      brand: 'Paraboot',
    },
    {
      name: 'Robe pull côtelée',
      category: 'Robe',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 9,
      salePrice: 31,
      soldPrice: 28,
      soldDaysAgo: 12,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'Uni', Taille: 'M', Couleur: 'Beige', Matière: 'Laine' },
      multi: { Occasion: ['Soirée', 'Cérémonie'] },
      brand: 'Maje',
    },
    {
      name: 'Blouson aviateur',
      category: 'Manteau',
      shop: GA,
      status: 'Vendu',
      purchasePrice: 19,
      salePrice: 68,
      soldPrice: 65,
      soldDaysAgo: 14,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'À carreaux', Taille: 'XL', Couleur: 'Beige', Matière: 'Cuir' },
      multi: { Occasion: ['Quotidien'] },
      flags: { Doublé: true },
      brand: 'Schott',
    },
    {
      name: 'Chemise en lin rayée',
      category: 'Chemise',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 6,
      salePrice: 22,
      soldPrice: 19,
      soldDaysAgo: 17,
      isOnline: true,
      pendingRemoval: true,
      options: { Motif: 'Rayé', Taille: 'M', Couleur: 'Blanc', Matière: 'Lin' },
      multi: { Occasion: ['Travail'] },
      brand: 'Uniqlo',
    },
    {
      name: 'Ceinture tressée',
      category: 'Accessoire',
      shop: MA,
      status: 'Vendu',
      purchasePrice: 4,
      stockDaysAgo: 22,
      salePrice: 16,
      soldPrice: 15,
      soldDaysAgo: 20,
      isOnline: true,
      pendingRemoval: true,
      options: { Couleur: 'Beige', Matière: 'Cuir' },
      multi: { Occasion: ['Quotidien'] },
      brand: 'Sandro',
    },
  ];

  // Les références suivent la règle de l'application : compteur d'entreprise
  // pour un achat, compteur du déposant pour un dépôt. Les compteurs sont
  // ensuite posés à leur valeur atteinte, sans quoi le prochain produit créé
  // par l'API buterait sur la contrainte d'unicité.
  let compteurAchat = 0;
  const compteurDepot = new Map<string, number>();

  // Les produits sont **remis à zéro** à chaque passage, contrairement au reste
  // du seed qui fait de l'upsert.
  //
  // Sauter les produits déjà présents avait l'air plus prudent, mais les
  // références se calculent dans l'ordre du tableau : insérer une entrée au
  // milieu décalait toutes les suivantes sur des références déjà prises, qui
  // étaient alors ignorées en silence — la base gardait un mélange de deux
  // versions du jeu de démonstration, et `make seed` ne pouvait plus la
  // réparer. Tout ce qui pend à un produit (attributs, historique) part avec
  // lui : les relations sont en cascade.
  await prisma.product.deleteMany({ where: { companyId: company.id } });

  let rangProduit = 0;
  for (const entry of products) {
    rangProduit += 1;
    const contrat = entry.contract ? contracts.get(entry.contract)! : null;
    const deposant = contrat ? depositors.get(contrat.depositor)! : null;

    let reference: string;
    if (deposant) {
      const rang = (compteurDepot.get(deposant.code) ?? 0) + 1;
      compteurDepot.set(deposant.code, rang);
      reference = `D-${deposant.code}-${String(rang).padStart(3, '0')}`;
    } else {
      compteurAchat += 1;
      reference = `A-${String(compteurAchat).padStart(4, '0')}`;
    }

    const vendu = entry.soldPrice !== undefined;
    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        shopId: entry.shop ? shops.get(entry.shop)! : null,
        categoryId: categories.get(entry.category)!,
        statusId: statuses.get(entry.status)!,
        reference,
        name: entry.name,
        saleType: contrat ? 'CONSIGNMENT' : ('RESALE' as SaleType),
        purchasePrice: contrat ? null : (entry.purchasePrice ?? null),
        salePrice: entry.salePrice,
        soldPrice: entry.soldPrice ?? null,
        depositContractId: contrat?.id ?? null,
        // Commission figée à la vente, jamais relue depuis le contrat.
        appliedCommission: vendu && contrat ? contrat.commission : null,
        depositorPaid: contrat ? (entry.depositorPaid ?? false) : null,
        soldAt: vendu ? ilYA(entry.soldDaysAgo ?? 0, 11 + (compteurAchat % 8)) : null,
        // Entrée en stock : celle de l'article quand elle est écrite, sinon de
        // quelques jours à trois mois avant la vente, pour que le temps de
        // rotation du tableau de bord raconte autre chose que « zéro jour ».
        // Déterministe, pour que deux `make seed` donnent la même démonstration.
        createdAt: ilYA(
          entry.stockDaysAgo ?? (entry.soldDaysAgo ?? 0) + 3 + ((rangProduit * 17) % 95),
          9,
        ),
        description: entry.description ?? null,
        internalNote: entry.note ?? null,
        quantity: entry.quantity ?? 1,
        isOnline: entry.isOnline ?? false,
        onlinePrice: entry.onlinePrice ?? null,
        pendingRemoval: entry.pendingRemoval ?? false,
      },
    });

    // Free-text attribute.
    await prisma.attributeValue.create({
      data: {
        productId: product.id,
        attributeDefinitionId: attributes.get('Marque')!,
        textValue: entry.brand,
      },
    });

    // SELECT et MULTISELECT : même table, une ligne par valeur retenue. Le
    // second en pose simplement plusieurs pour le même attribut — c'est
    // pourquoi un article y compte dans chacun de ses classements.
    const poserOption = async (attributeName: string, value: string) => {
      const option = await prisma.attributeOption.findUniqueOrThrow({
        where: {
          attributeDefinitionId_value: {
            attributeDefinitionId: attributes.get(attributeName)!,
            value,
          },
        },
      });
      await prisma.productAttributeOption.create({
        data: { productId: product.id, attributeOptionId: option.id },
      });
    };
    for (const [attributeName, value] of Object.entries(entry.options)) {
      await poserOption(attributeName, value);
    }
    for (const [attributeName, values] of Object.entries(entry.multi ?? {})) {
      for (const value of values) await poserOption(attributeName, value);
    }

    // NUMBER et BOOLEAN : renseignés sur les fiches, absents des classements du
    // tableau de bord — ranger des pointures par chiffre d'affaires ne répond à
    // aucune question. Ils sont là pour qu'on le constate.
    for (const [attributeName, numberValue] of Object.entries(entry.numbers ?? {})) {
      await prisma.attributeValue.create({
        data: {
          productId: product.id,
          attributeDefinitionId: attributes.get(attributeName)!,
          numberValue,
        },
      });
    }
    for (const [attributeName, booleanValue] of Object.entries(entry.flags ?? {})) {
      await prisma.attributeValue.create({
        data: {
          productId: product.id,
          attributeDefinitionId: attributes.get(attributeName)!,
          booleanValue,
        },
      });
    }

    // Un historique crédible plutôt qu'une ligne unique : la fiche produit
    // affiche ce parcours, et une seule entrée ne montrait jamais à quoi
    // ressemble un article qui a vécu. Le chemin suit le flux réel — sans quoi
    // l'historique raconterait des passages que l'application refuserait.
    const chemin = CHEMINS[entry.status] ?? [entry.status];
    const fin = vendu ? (entry.soldDaysAgo ?? 0) : 0;
    for (const [rang, etape] of chemin.entries()) {
      // Le dernier pas porte la date de vente ; les précédents remontent le
      // temps, un par jour, pour que l'ordre se lise.
      const joursAvant = fin + (chemin.length - 1 - rang) * 3;
      await prisma.statusHistory.create({
        data: {
          productId: product.id,
          statusId: statuses.get(etape)!,
          // L'employé fait tourner la boutique, le gérant ouvre le stock.
          changedByUserId: rang === 0 ? manager.id : employee.id,
          note: rang === 0 ? 'Entrée en stock' : null,
          changedAt: ilYA(joursAvant, 9 + ((compteurAchat + rang) % 9)),
        },
      });
    }
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { productCounter: compteurAchat },
  });
  for (const [code, rang] of compteurDepot) {
    const deposant = [...depositors.values()].find((d) => d.code === code)!;
    await prisma.depositor.update({
      where: { id: deposant.id },
      data: { productCounter: rang },
    });
  }

  console.log(`  ${products.length} produits`);

  console.log('\nComptes de démonstration (développement uniquement) :');
  console.log(`  gérant   ${MANAGER_EMAIL}  / ${DEMO_PASSWORD}`);
  console.log(`  employé  ${EMPLOYEE_EMAIL} / ${DEMO_PASSWORD}`);
  for (const acces of ACCES_EMPLOYE) {
    console.log(`           « ${acces.shop} » : ${Object.keys(acces.permissions).join(', ')}`);
  }
  console.log('           jamais stats.view : le tableau de bord doit lui cacher les marges');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
