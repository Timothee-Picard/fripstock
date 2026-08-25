/**
 * Seed Fripstock.
 *
 * Insère la bibliothèque globale de templates d'attributs, puis une entreprise
 * de démonstration complète (gérant, boutique, catalogue, statuts, déposant,
 * produits) pour pouvoir travailler sur l'UI dès l'étape suivante.
 *
 * Idempotent : relançable sans dupliquer les données.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import type { PermissionMap } from '../src/common/permissions';
import { PrismaClient } from '../src/generated/prisma/client';
import { TypeAttribut, TypeVente } from '../src/generated/prisma/enums';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL manquante — le seed doit tourner dans le conteneur api.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) });

const EMAIL_GERANT = 'gerant@fripstock.test';
const EMAIL_EMPLOYE = 'employe@fripstock.test';
const MOT_DE_PASSE_DEMO = 'fripstock';

/**
 * Permissions volontairement partielles : l'employé de démonstration peut voir
 * et créer des produits, rien d'autre. Tout le reste doit lui renvoyer un 403,
 * c'est ce qui rend la restriction testable sans bricoler un compte à la main.
 */
const PERMISSIONS_EMPLOYE_DEMO: PermissionMap = {
  'produits.voir': true,
  'produits.creer': true,
};

/** Bibliothèque globale, partagée par toutes les entreprises, en lecture seule. */
const TEMPLATES: { nom: string; type: TypeAttribut; options: string[] }[] = [
  { nom: 'Taille', type: 'SELECT', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  {
    nom: 'Couleur',
    type: 'SELECT',
    options: ['Noir', 'Blanc', 'Gris', 'Bleu', 'Rouge', 'Vert', 'Beige', 'Multicolore'],
  },
  {
    nom: 'Matière',
    type: 'SELECT',
    options: ['Coton', 'Laine', 'Cuir', 'Jean', 'Lin', 'Synthétique'],
  },
  { nom: 'Marque', type: 'TEXT', options: [] },
];

/**
 * Les six statuts de base. Les flags — et non le libellé, que le gérant peut
 * renommer — pilotent la logique métier. Voir CLAUDE.md, section "Statuts".
 */
const STATUTS = [
  {
    nom: 'En stock',
    couleur: '#6b7280',
    estDefaut: true,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
  },
  {
    nom: 'En rayon',
    couleur: '#3b82f6',
    estDefaut: false,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
  },
  {
    nom: 'Réservé',
    couleur: '#f59e0b',
    estDefaut: false,
    estVente: false,
    bloqueVente: false,
    sortStock: false,
  },
  {
    nom: 'Vendu',
    couleur: '#10b981',
    estDefaut: false,
    estVente: true,
    bloqueVente: false,
    sortStock: true,
  },
  {
    nom: 'Rendu au client',
    couleur: '#8b5cf6',
    estDefaut: false,
    estVente: false,
    bloqueVente: true,
    sortStock: true,
  },
  {
    nom: 'Retiré',
    couleur: '#ef4444',
    estDefaut: false,
    estVente: false,
    bloqueVente: true,
    sortStock: true,
  },
];

/** Quels attributs s'appliquent à quelle catégorie : un sac n'a pas de taille. */
const CATEGORIES: { nom: string; attributs: string[] }[] = [
  { nom: 'Robe', attributs: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { nom: 'Haut', attributs: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { nom: 'Chemise', attributs: ['Taille', 'Couleur', 'Matière', 'Marque'] },
  { nom: 'Chaussures', attributs: ['Taille', 'Couleur', 'Marque'] },
  { nom: 'Sac', attributs: ['Couleur', 'Matière', 'Marque'] },
];

async function seedTemplates() {
  for (const t of TEMPLATES) {
    const template = await prisma.attributTemplate.upsert({
      where: { nom: t.nom },
      update: { type: t.type },
      create: { nom: t.nom, type: t.type },
    });
    for (const [ordre, valeur] of t.options.entries()) {
      await prisma.attributTemplateOption.upsert({
        where: { attributTemplateId_valeur: { attributTemplateId: template.id, valeur } },
        update: { ordre },
        create: { attributTemplateId: template.id, valeur, ordre },
      });
    }
  }
  console.log(`  ${TEMPLATES.length} templates d'attributs`);
}

async function main() {
  // Ce seed crée des comptes aux identifiants publics et connus de tous. Il ne
  // doit jamais s'exécuter ailleurs qu'en développement.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Le seed crée des comptes de démonstration : refus de tourner avec NODE_ENV=production.',
    );
  }

  console.log('Seed Fripstock');

  await seedTemplates();

  // --- Entreprise de démonstration ---------------------------------------
  let entreprise = await prisma.entreprise.findFirst({ where: { nom: 'Friperie Démo' } });
  entreprise ??= await prisma.entreprise.create({ data: { nom: 'Friperie Démo' } });

  const gerant = await prisma.user.upsert({
    where: { email: EMAIL_GERANT },
    update: {},
    create: {
      entrepriseId: entreprise.id,
      email: EMAIL_GERANT,
      motDePasseHash: await bcrypt.hash(MOT_DE_PASSE_DEMO, 10),
      prenom: 'Camille',
      nom: 'Durand',
      estGerant: true,
    },
  });

  let boutique = await prisma.boutique.findFirst({
    where: { entrepriseId: entreprise.id, nom: 'Boutique Centre-ville' },
  });
  boutique ??= await prisma.boutique.create({
    data: {
      entrepriseId: entreprise.id,
      nom: 'Boutique Centre-ville',
      adresse: '12 rue des Lilas, Lyon',
    },
  });

  // --- Employé de démonstration, aux droits limités ----------------------
  const employe = await prisma.user.upsert({
    where: { email: EMAIL_EMPLOYE },
    update: {},
    create: {
      entrepriseId: entreprise.id,
      email: EMAIL_EMPLOYE,
      motDePasseHash: await bcrypt.hash(MOT_DE_PASSE_DEMO, 10),
      prenom: 'Théo',
      nom: 'Bernard',
      estGerant: false,
    },
  });

  await prisma.accesBoutique.upsert({
    where: { userId_boutiqueId: { userId: employe.id, boutiqueId: boutique.id } },
    update: { permissions: PERMISSIONS_EMPLOYE_DEMO },
    create: {
      userId: employe.id,
      boutiqueId: boutique.id,
      permissions: PERMISSIONS_EMPLOYE_DEMO,
    },
  });

  // --- Statuts ------------------------------------------------------------
  const statuts = new Map<string, string>();
  for (const [ordre, s] of STATUTS.entries()) {
    const statut = await prisma.statut.upsert({
      where: { entrepriseId_nom: { entrepriseId: entreprise.id, nom: s.nom } },
      update: { ...s, ordre },
      create: { ...s, ordre, entrepriseId: entreprise.id },
    });
    statuts.set(s.nom, statut.id);
  }
  console.log(`  ${STATUTS.length} statuts`);

  // --- Attributs de l'entreprise, clonés depuis les templates -------------
  const attributs = new Map<string, string>();
  for (const t of TEMPLATES) {
    const template = await prisma.attributTemplate.findUniqueOrThrow({
      where: { nom: t.nom },
      include: { options: true },
    });
    const attribut = await prisma.attributDefinition.upsert({
      where: { entrepriseId_nom: { entrepriseId: entreprise.id, nom: t.nom } },
      update: {},
      create: {
        entrepriseId: entreprise.id,
        nom: template.nom,
        type: template.type,
        clonedFromTemplateId: template.id,
      },
    });
    // Le clone copie les options du template puis devient indépendant.
    for (const option of template.options) {
      await prisma.attributOption.upsert({
        where: {
          attributDefinitionId_valeur: { attributDefinitionId: attribut.id, valeur: option.valeur },
        },
        update: { ordre: option.ordre },
        create: { attributDefinitionId: attribut.id, valeur: option.valeur, ordre: option.ordre },
      });
    }
    attributs.set(t.nom, attribut.id);
  }
  console.log(`  ${TEMPLATES.length} attributs clonés pour l'entreprise`);

  // --- Catégories ---------------------------------------------------------
  const categories = new Map<string, string>();
  let vetements = await prisma.categorie.findFirst({
    where: { entrepriseId: entreprise.id, nom: 'Vêtements' },
  });
  vetements ??= await prisma.categorie.create({
    data: { entrepriseId: entreprise.id, nom: 'Vêtements' },
  });

  for (const c of CATEGORIES) {
    let categorie = await prisma.categorie.findFirst({
      where: { entrepriseId: entreprise.id, nom: c.nom },
    });
    categorie ??= await prisma.categorie.create({
      data: {
        entrepriseId: entreprise.id,
        nom: c.nom,
        // Les accessoires ne sont pas des vêtements : Sac reste à la racine.
        parentId: c.nom === 'Sac' ? null : vetements.id,
      },
    });
    categories.set(c.nom, categorie.id);

    for (const nomAttribut of c.attributs) {
      const attributId = attributs.get(nomAttribut)!;
      await prisma.categorieAttribut.upsert({
        where: {
          categorieId_attributDefinitionId: {
            categorieId: categorie.id,
            attributDefinitionId: attributId,
          },
        },
        update: {},
        create: { categorieId: categorie.id, attributDefinitionId: attributId },
      });
    }
  }
  console.log(`  ${CATEGORIES.length + 1} catégories`);

  // --- Client déposant et contrat ----------------------------------------
  let deposant = await prisma.client.findFirst({
    where: { entrepriseId: entreprise.id, nom: 'Martin', prenom: 'Sophie' },
  });
  deposant ??= await prisma.client.create({
    data: {
      entrepriseId: entreprise.id,
      nom: 'Martin',
      prenom: 'Sophie',
      email: 'sophie.martin@example.test',
      telephone: '0612345678',
      iban: 'FR7630001007941234567890185',
      // 40 % pour la boutique, donc 60 % pour la déposante.
      commissionDefaut: 40,
    },
  });

  const dateDebut = new Date('2026-08-01T00:00:00Z');
  const dateFin = new Date('2026-10-30T00:00:00Z');
  let contrat = await prisma.contratDepot.findFirst({ where: { clientId: deposant.id } });
  contrat ??= await prisma.contratDepot.create({
    data: {
      clientId: deposant.id,
      dateDebut,
      dateFin,
      commission: deposant.commissionDefaut,
      notifyBeforeDays: 5,
    },
  });

  // --- Produits de démonstration -----------------------------------------
  const produits = [
    {
      reference: 'BTR6',
      nom: 'Robe fleurie été',
      categorie: 'Robe',
      statut: 'En rayon',
      typeVente: 'ACHAT_REVENTE' as TypeVente,
      prixAchat: 8,
      prixVente: 25,
      options: { Taille: 'M', Couleur: 'Multicolore', Matière: 'Coton' },
      marque: 'Zara',
    },
    {
      reference: 'BTA4',
      nom: 'Chemise en lin',
      categorie: 'Chemise',
      statut: 'En stock',
      typeVente: 'ACHAT_REVENTE' as TypeVente,
      prixAchat: 5,
      prixVente: 18,
      options: { Taille: 'L', Couleur: 'Blanc', Matière: 'Lin' },
      marque: 'Uniqlo',
    },
    {
      reference: 'DEP1',
      nom: 'Sac à main cuir',
      categorie: 'Sac',
      statut: 'En rayon',
      typeVente: 'DEPOT_VENTE' as TypeVente,
      prixVente: 60,
      contrat: true,
      options: { Couleur: 'Noir', Matière: 'Cuir' },
      marque: 'Lancel',
    },
    {
      reference: 'DEP2',
      nom: 'Bottines daim',
      categorie: 'Chaussures',
      statut: 'Vendu',
      typeVente: 'DEPOT_VENTE' as TypeVente,
      prixVente: 45,
      prixVendu: 40,
      contrat: true,
      vendu: true,
      options: { Taille: 'S', Couleur: 'Beige' },
      marque: 'Minelli',
    },
  ];

  for (const p of produits) {
    const existant = await prisma.produit.findFirst({
      where: { entrepriseId: entreprise.id, reference: p.reference },
    });
    if (existant) continue;

    const produit = await prisma.produit.create({
      data: {
        entrepriseId: entreprise.id,
        boutiqueId: boutique.id,
        categorieId: categories.get(p.categorie)!,
        statutId: statuts.get(p.statut)!,
        reference: p.reference,
        nom: p.nom,
        typeVente: p.typeVente,
        prixAchat: p.prixAchat ?? null,
        prixVente: p.prixVente,
        prixVendu: p.prixVendu ?? null,
        contratDepotId: p.contrat ? contrat.id : null,
        // Commission figée au moment de la vente, jamais relue depuis le contrat.
        commissionAppliquee: p.vendu ? contrat.commission : null,
        deposantPaye: p.typeVente === 'DEPOT_VENTE' ? false : null,
        dateVente: p.vendu ? new Date('2026-08-20T14:30:00Z') : null,
      },
    });

    // Attribut texte libre.
    await prisma.valeurAttribut.create({
      data: {
        produitId: produit.id,
        attributDefinitionId: attributs.get('Marque')!,
        valeurTexte: p.marque,
      },
    });

    // Attributs de type SELECT.
    for (const [nomAttribut, valeur] of Object.entries(p.options)) {
      const option = await prisma.attributOption.findUniqueOrThrow({
        where: {
          attributDefinitionId_valeur: {
            attributDefinitionId: attributs.get(nomAttribut)!,
            valeur,
          },
        },
      });
      await prisma.produitAttributOption.create({
        data: { produitId: produit.id, attributOptionId: option.id },
      });
    }

    await prisma.historiqueStatut.create({
      data: {
        produitId: produit.id,
        statutId: statuts.get(p.statut)!,
        changedByUserId: gerant.id,
        note: 'Création via le seed',
      },
    });
  }
  console.log(`  ${produits.length} produits`);

  console.log('\nComptes de démonstration (développement uniquement) :');
  console.log(`  gérant   ${EMAIL_GERANT}  / ${MOT_DE_PASSE_DEMO}`);
  console.log(`  employé  ${EMAIL_EMPLOYE} / ${MOT_DE_PASSE_DEMO}`);
  console.log(`           accès à « ${boutique.nom} », permissions :`);
  console.log(`           ${Object.keys(PERMISSIONS_EMPLOYE_DEMO).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
