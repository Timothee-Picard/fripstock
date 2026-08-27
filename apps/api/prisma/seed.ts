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
 * Deliberately partial permissions: the demo employee may view and create
 * products, nothing else. Everything else must answer 403, which is what makes
 * the restriction testable without hand-crafting an account.
 */
const DEMO_EMPLOYEE_PERMISSIONS: PermissionMap = {
  'products.view': true,
  'products.create': true,
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
  { name: 'Chaussures', attributes: ['Taille', 'Couleur', 'Marque'] },
  { name: 'Sac', attributes: ['Couleur', 'Matière', 'Marque'] },
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

  let shop = await prisma.shop.findFirst({
    where: { companyId: company.id, name: 'Boutique Centre-ville' },
  });
  shop ??= await prisma.shop.create({
    data: {
      companyId: company.id,
      name: 'Boutique Centre-ville',
      address: '12 rue des Lilas, Lyon',
    },
  });

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

  await prisma.shopAccess.upsert({
    where: { userId_shopId: { userId: employee.id, shopId: shop.id } },
    update: { permissions: DEMO_EMPLOYEE_PERMISSIONS },
    create: {
      userId: employee.id,
      shopId: shop.id,
      permissions: DEMO_EMPLOYEE_PERMISSIONS,
    },
  });

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

  // --- Depositor and contract ---------------------------------------------
  let depositor = await prisma.depositor.findFirst({
    where: { companyId: company.id, lastName: 'Martin', firstName: 'Sophie' },
  });
  depositor ??= await prisma.depositor.create({
    data: {
      companyId: company.id,
      lastName: 'Martin',
      firstName: 'Sophie',
      email: 'sophie.martin@example.test',
      phone: '0612345678',
      iban: 'FR7630001007941234567890185',
      // 40% for the shop, so 60% for the depositor.
      defaultCommission: 40,
      // Code used in this depositor's product references (the MAR of D-MAR-001).
      code: 'MAR',
    },
  });

  let contract = await prisma.depositContract.findFirst({
    where: { depositorId: depositor.id },
  });
  contract ??= await prisma.depositContract.create({
    data: {
      depositorId: depositor.id,
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-10-30T00:00:00Z'),
      commission: depositor.defaultCommission,
      notifyBeforeDays: 5,
    },
  });

  // --- Demo products ------------------------------------------------------
  const products = [
    {
      reference: 'A-0001',
      name: 'Robe fleurie été',
      category: 'Robe',
      status: 'En stock',
      saleType: 'RESALE' as SaleType,
      purchasePrice: 8,
      salePrice: 25,
      options: { Taille: 'M', Couleur: 'Multicolore', Matière: 'Coton' },
      brand: 'Zara',
    },
    {
      reference: 'A-0002',
      name: 'Chemise en lin',
      category: 'Chemise',
      status: 'En stock',
      saleType: 'RESALE' as SaleType,
      purchasePrice: 5,
      salePrice: 18,
      options: { Taille: 'L', Couleur: 'Blanc', Matière: 'Lin' },
      brand: 'Uniqlo',
    },
    {
      reference: 'D-MAR-001',
      name: 'Sac à main cuir',
      category: 'Sac',
      status: 'En rayon',
      saleType: 'CONSIGNMENT' as SaleType,
      salePrice: 60,
      onContract: true,
      options: { Couleur: 'Noir', Matière: 'Cuir' },
      brand: 'Lancel',
    },
    {
      reference: 'D-MAR-002',
      name: 'Bottines daim',
      category: 'Chaussures',
      status: 'Vendu',
      saleType: 'CONSIGNMENT' as SaleType,
      salePrice: 45,
      soldPrice: 40,
      onContract: true,
      sold: true,
      options: { Taille: 'S', Couleur: 'Beige' },
      brand: 'Minelli',
    },
  ];

  // Counters aligned with the references written above: the next product
  // created through the API continues the sequence instead of colliding.
  await prisma.company.update({ where: { id: company.id }, data: { productCounter: 2 } });
  await prisma.depositor.update({ where: { id: depositor.id }, data: { productCounter: 2 } });

  for (const entry of products) {
    const existing = await prisma.product.findFirst({
      where: { companyId: company.id, reference: entry.reference },
    });
    if (existing) continue;

    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        shopId: shop.id,
        categoryId: categories.get(entry.category)!,
        statusId: statuses.get(entry.status)!,
        reference: entry.reference,
        name: entry.name,
        saleType: entry.saleType,
        purchasePrice: entry.purchasePrice ?? null,
        salePrice: entry.salePrice,
        soldPrice: entry.soldPrice ?? null,
        depositContractId: entry.onContract ? contract.id : null,
        // Commission frozen at sale time, never read back from the contract.
        appliedCommission: entry.sold ? contract.commission : null,
        depositorPaid: entry.saleType === 'CONSIGNMENT' ? false : null,
        soldAt: entry.sold ? new Date('2026-08-20T14:30:00Z') : null,
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
  console.log(`  ${products.length} produits`);

  console.log('\nComptes de démonstration (développement uniquement) :');
  console.log(`  gérant   ${MANAGER_EMAIL}  / ${DEMO_PASSWORD}`);
  console.log(`  employé  ${EMPLOYEE_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`           accès à « ${shop.name} », permissions :`);
  console.log(`           ${Object.keys(DEMO_EMPLOYEE_PERMISSIONS).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
