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
import { PrismaClient } from '../src/generated/prisma/client';
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
  'products.create': true,
  'stock.view': true,
};

const DEMO_TILL_PERMISSIONS: PermissionMap = {
  'products.view': true,
  'products.changeStatus': true,
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
];

/** Which attributes apply to which category: a bag has no size. */
const CATEGORIES: { name: string; attributes: string[] }[] = [
  { name: 'Robe', attributes: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { name: 'Haut', attributes: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { name: 'Chemise', attributes: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { name: 'Pantalon', attributes: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { name: 'Manteau', attributes: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { name: 'Chaussures', attributes: ['Taille', 'Couleur', 'Marque'] },
  { name: 'Sac', attributes: ['Couleur', 'Matière', 'Marque'] },
  { name: 'Accessoire', attributes: ['Couleur', 'Matière', 'Marque'] },
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
  // tested, changing password among other things.
  const manager = await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: {
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName: 'Camille',
      lastName: 'Durand',
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
    options: Record<string, string>;
    brand: string;
  }

  const [CV, GA, MA] = BOUTIQUES.map((b) => b.name);

  const products: Entree[] = [
    // --- Achat-revente, en stock ------------------------------------------
    {
      name: 'Robe fleurie été',
      category: 'Robe',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 8,
      salePrice: 25,
      options: { Taille: 'M', Couleur: 'Multicolore', Matière: 'Coton' },
      brand: 'Zara',
    },
    {
      name: 'Chemise en lin',
      category: 'Chemise',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 5,
      salePrice: 18,
      options: { Taille: 'L', Couleur: 'Blanc', Matière: 'Lin' },
      brand: 'Uniqlo',
    },
    {
      name: 'Jean brut droit',
      category: 'Pantalon',
      shop: CV,
      status: 'En rayon',
      purchasePrice: 6,
      salePrice: 22,
      options: { Taille: 'M', Couleur: 'Bleu', Matière: 'Jean' },
      brand: "Levi's",
    },
    {
      name: 'Pull col rond',
      category: 'Haut',
      shop: GA,
      status: 'En rayon',
      purchasePrice: 4,
      salePrice: 15,
      options: { Taille: 'S', Couleur: 'Gris', Matière: 'Laine' },
      brand: 'Monoprix',
    },
    {
      name: 'Manteau laine long',
      category: 'Manteau',
      shop: GA,
      status: 'En rayon',
      purchasePrice: 20,
      salePrice: 65,
      options: { Taille: 'M', Couleur: 'Noir', Matière: 'Laine' },
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
      brand: 'Sans marque',
    },
    {
      name: 'Écharpe laine',
      category: 'Accessoire',
      shop: GA,
      status: 'En stock',
      purchasePrice: 2,
      salePrice: 9,
      options: { Couleur: 'Rouge', Matière: 'Laine' },
      brand: 'Sans marque',
    },
    {
      name: 'Chemise oversize',
      category: 'Chemise',
      shop: null,
      status: 'En stock',
      purchasePrice: 4,
      salePrice: 16,
      options: { Taille: 'XL', Couleur: 'Vert', Matière: 'Coton' },
      brand: 'Bershka',
    },
    {
      name: 'Robe noire droite',
      category: 'Robe',
      shop: null,
      status: 'En stock',
      purchasePrice: 7,
      salePrice: 24,
      options: { Taille: 'S', Couleur: 'Noir', Matière: 'Synthétique' },
      brand: 'Mango',
    },
    {
      name: 'Sac bandoulière',
      category: 'Sac',
      shop: null,
      status: 'En stock',
      purchasePrice: 9,
      salePrice: 28,
      options: { Couleur: 'Beige', Matière: 'Cuir' },
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
      brand: "Levi's",
    },
    {
      name: 'T-shirt rayé',
      category: 'Haut',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 2,
      salePrice: 10,
      soldPrice: 8,
      soldDaysAgo: 0,
      options: { Taille: 'S', Couleur: 'Blanc', Matière: 'Coton' },
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
      options: { Taille: 'M', Couleur: 'Vert', Matière: 'Synthétique' },
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
      options: { Taille: 'L', Couleur: 'Gris', Matière: 'Coton' },
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
      options: { Taille: 'S', Couleur: 'Multicolore', Matière: 'Synthétique' },
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
      options: { Couleur: 'Bleu', Matière: 'Coton' },
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
      options: { Taille: 'M', Couleur: 'Noir', Matière: 'Synthétique' },
      brand: 'Uniqlo',
    },
    {
      name: 'Mocassins daim',
      category: 'Chaussures',
      shop: CV,
      status: 'Vendu',
      purchasePrice: 9,
      salePrice: 29,
      soldPrice: 29,
      soldDaysAgo: 31,
      options: { Taille: 'L', Couleur: 'Beige' },
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
      brand: 'Lancel',
    },
    {
      name: 'Robe de soirée',
      category: 'Robe',
      shop: CV,
      status: 'Réservé',
      contract: 'martin-ete',
      salePrice: 85,
      options: { Taille: 'S', Couleur: 'Noir', Matière: 'Synthétique' },
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
      brand: 'Hermès',
    },
    {
      name: 'Chemisier blanc',
      category: 'Chemise',
      shop: CV,
      status: 'Rendu au client',
      contract: 'martin-ete',
      salePrice: 22,
      options: { Taille: 'M', Couleur: 'Blanc', Matière: 'Coton' },
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
      options: { Taille: 'M', Couleur: 'Beige', Matière: 'Laine' },
      brand: 'Sézane',
    },
    {
      name: 'Pull cachemire',
      category: 'Haut',
      shop: GA,
      status: 'En rayon',
      contract: 'martin-hiver',
      salePrice: 55,
      options: { Taille: 'S', Couleur: 'Gris', Matière: 'Laine' },
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
      brand: 'Converse',
    },
    {
      name: 'Sac à dos toile',
      category: 'Sac',
      shop: GA,
      status: 'En stock',
      contract: 'durand',
      salePrice: 38,
      options: { Couleur: 'Vert', Matière: 'Coton' },
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
      options: { Taille: 'S', Couleur: 'Bleu', Matière: 'Synthétique' },
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
      options: { Taille: 'M', Couleur: 'Noir', Matière: 'Laine' },
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
      options: { Taille: 'M', Couleur: 'Multicolore', Matière: 'Coton' },
      brand: 'Sans marque',
    },
    {
      name: 'Sac vernis',
      category: 'Sac',
      shop: MA,
      status: 'Vendu',
      contract: 'bonnet',
      salePrice: 55,
      soldPrice: 50,
      soldDaysAgo: 40,
      depositorPaid: true,
      options: { Couleur: 'Rouge', Matière: 'Synthétique' },
      brand: 'Vanessa Bruno',
    },
  ];

  // Les références suivent la règle de l'application : compteur d'entreprise
  // pour un achat, compteur du déposant pour un dépôt. Les compteurs sont
  // ensuite posés à leur valeur atteinte, sans quoi le prochain produit créé
  // par l'API buterait sur la contrainte d'unicité.
  let compteurAchat = 0;
  const compteurDepot = new Map<string, number>();

  for (const entry of products) {
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

    const existing = await prisma.product.findFirst({
      where: { companyId: company.id, reference },
    });
    if (existing) continue;

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

    // SELECT attributes.
    for (const [attributeName, value] of Object.entries(entry.options)) {
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
    }

    await prisma.statusHistory.create({
      data: {
        productId: product.id,
        statusId: statuses.get(entry.status)!,
        changedByUserId: manager.id,
        note: 'Création via le seed',
      },
    });
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
  console.log(`           aucun accès à « ${BOUTIQUES[2].name} »`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
