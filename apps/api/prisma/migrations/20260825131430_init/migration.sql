-- CreateEnum
CREATE TYPE "type_attribut" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "statut_contrat" AS ENUM ('ACTIF', 'EXPIRE', 'CLOS');

-- CreateEnum
CREATE TYPE "type_vente" AS ENUM ('ACHAT_REVENTE', 'DEPOT_VENTE');

-- CreateTable
CREATE TABLE "entreprise" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutique" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "est_gerant" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acces_boutique" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "boutique_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acces_boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorie" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "nom" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribut_template" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "type_attribut" NOT NULL,

    CONSTRAINT "attribut_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribut_template_option" (
    "id" TEXT NOT NULL,
    "attribut_template_id" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attribut_template_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribut_definition" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "type_attribut" NOT NULL,
    "cloned_from_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribut_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribut_option" (
    "id" TEXT NOT NULL,
    "attribut_definition_id" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attribut_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorie_attribut" (
    "categorie_id" TEXT NOT NULL,
    "attribut_definition_id" TEXT NOT NULL,

    CONSTRAINT "categorie_attribut_pkey" PRIMARY KEY ("categorie_id","attribut_definition_id")
);

-- CreateTable
CREATE TABLE "statut" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#6b7280',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "est_defaut" BOOLEAN NOT NULL DEFAULT false,
    "est_vente" BOOLEAN NOT NULL DEFAULT false,
    "bloque_vente" BOOLEAN NOT NULL DEFAULT false,
    "sort_stock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "iban" TEXT,
    "commission_defaut" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrat_depot" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "commission" DECIMAL(5,2) NOT NULL,
    "notify_before_days" INTEGER NOT NULL DEFAULT 7,
    "statut" "statut_contrat" NOT NULL DEFAULT 'ACTIF',
    "notifie_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrat_depot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produit" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "boutique_id" TEXT,
    "categorie_id" TEXT NOT NULL,
    "statut_id" TEXT NOT NULL,
    "reference" TEXT,
    "sku" TEXT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "commentaire" TEXT,
    "photo_url" TEXT,
    "prix_achat" DECIMAL(10,2),
    "prix_vente" DECIMAL(10,2),
    "prix_vendu" DECIMAL(10,2),
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "type_vente" "type_vente" NOT NULL,
    "contrat_depot_id" TEXT,
    "commission_appliquee" DECIMAL(5,2),
    "deposant_paye" BOOLEAN,
    "date_vente" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valeur_attribut" (
    "id" TEXT NOT NULL,
    "produit_id" TEXT NOT NULL,
    "attribut_definition_id" TEXT NOT NULL,
    "valeur_texte" TEXT,
    "valeur_nombre" DECIMAL(12,3),
    "valeur_booleenne" BOOLEAN,

    CONSTRAINT "valeur_attribut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produit_attribut_option" (
    "produit_id" TEXT NOT NULL,
    "attribut_option_id" TEXT NOT NULL,

    CONSTRAINT "produit_attribut_option_pkey" PRIMARY KEY ("produit_id","attribut_option_id")
);

-- CreateTable
CREATE TABLE "historique_statut" (
    "id" TEXT NOT NULL,
    "produit_id" TEXT NOT NULL,
    "statut_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "historique_statut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "entreprise_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contrat_depot_id" TEXT,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boutique_entreprise_id_idx" ON "boutique"("entreprise_id");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "utilisateur_entreprise_id_idx" ON "utilisateur"("entreprise_id");

-- CreateIndex
CREATE INDEX "acces_boutique_user_id_idx" ON "acces_boutique"("user_id");

-- CreateIndex
CREATE INDEX "acces_boutique_boutique_id_idx" ON "acces_boutique"("boutique_id");

-- CreateIndex
CREATE UNIQUE INDEX "acces_boutique_user_id_boutique_id_key" ON "acces_boutique"("user_id", "boutique_id");

-- CreateIndex
CREATE INDEX "categorie_entreprise_id_idx" ON "categorie"("entreprise_id");

-- CreateIndex
CREATE INDEX "categorie_parent_id_idx" ON "categorie"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribut_template_nom_key" ON "attribut_template"("nom");

-- CreateIndex
CREATE INDEX "attribut_template_option_attribut_template_id_idx" ON "attribut_template_option"("attribut_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribut_template_option_attribut_template_id_valeur_key" ON "attribut_template_option"("attribut_template_id", "valeur");

-- CreateIndex
CREATE INDEX "attribut_definition_entreprise_id_idx" ON "attribut_definition"("entreprise_id");

-- CreateIndex
CREATE INDEX "attribut_definition_cloned_from_template_id_idx" ON "attribut_definition"("cloned_from_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribut_definition_entreprise_id_nom_key" ON "attribut_definition"("entreprise_id", "nom");

-- CreateIndex
CREATE INDEX "attribut_option_attribut_definition_id_idx" ON "attribut_option"("attribut_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribut_option_attribut_definition_id_valeur_key" ON "attribut_option"("attribut_definition_id", "valeur");

-- CreateIndex
CREATE INDEX "categorie_attribut_categorie_id_idx" ON "categorie_attribut"("categorie_id");

-- CreateIndex
CREATE INDEX "categorie_attribut_attribut_definition_id_idx" ON "categorie_attribut"("attribut_definition_id");

-- CreateIndex
CREATE INDEX "statut_entreprise_id_idx" ON "statut"("entreprise_id");

-- CreateIndex
CREATE UNIQUE INDEX "statut_entreprise_id_nom_key" ON "statut"("entreprise_id", "nom");

-- CreateIndex
CREATE INDEX "client_entreprise_id_idx" ON "client"("entreprise_id");

-- CreateIndex
CREATE INDEX "contrat_depot_client_id_idx" ON "contrat_depot"("client_id");

-- CreateIndex
CREATE INDEX "contrat_depot_date_fin_idx" ON "contrat_depot"("date_fin");

-- CreateIndex
CREATE INDEX "produit_entreprise_id_idx" ON "produit"("entreprise_id");

-- CreateIndex
CREATE INDEX "produit_boutique_id_idx" ON "produit"("boutique_id");

-- CreateIndex
CREATE INDEX "produit_categorie_id_idx" ON "produit"("categorie_id");

-- CreateIndex
CREATE INDEX "produit_statut_id_idx" ON "produit"("statut_id");

-- CreateIndex
CREATE INDEX "produit_contrat_depot_id_idx" ON "produit"("contrat_depot_id");

-- CreateIndex
CREATE INDEX "produit_reference_idx" ON "produit"("reference");

-- CreateIndex
CREATE INDEX "valeur_attribut_produit_id_idx" ON "valeur_attribut"("produit_id");

-- CreateIndex
CREATE INDEX "valeur_attribut_attribut_definition_id_idx" ON "valeur_attribut"("attribut_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "valeur_attribut_produit_id_attribut_definition_id_key" ON "valeur_attribut"("produit_id", "attribut_definition_id");

-- CreateIndex
CREATE INDEX "produit_attribut_option_produit_id_idx" ON "produit_attribut_option"("produit_id");

-- CreateIndex
CREATE INDEX "produit_attribut_option_attribut_option_id_idx" ON "produit_attribut_option"("attribut_option_id");

-- CreateIndex
CREATE INDEX "historique_statut_produit_id_idx" ON "historique_statut"("produit_id");

-- CreateIndex
CREATE INDEX "historique_statut_statut_id_idx" ON "historique_statut"("statut_id");

-- CreateIndex
CREATE INDEX "historique_statut_changed_by_user_id_idx" ON "historique_statut"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "notification_entreprise_id_idx" ON "notification"("entreprise_id");

-- CreateIndex
CREATE INDEX "notification_contrat_depot_id_idx" ON "notification"("contrat_depot_id");

-- AddForeignKey
ALTER TABLE "boutique" ADD CONSTRAINT "boutique_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_boutique" ADD CONSTRAINT "acces_boutique_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acces_boutique" ADD CONSTRAINT "acces_boutique_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorie" ADD CONSTRAINT "categorie_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorie" ADD CONSTRAINT "categorie_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribut_template_option" ADD CONSTRAINT "attribut_template_option_attribut_template_id_fkey" FOREIGN KEY ("attribut_template_id") REFERENCES "attribut_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribut_definition" ADD CONSTRAINT "attribut_definition_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribut_definition" ADD CONSTRAINT "attribut_definition_cloned_from_template_id_fkey" FOREIGN KEY ("cloned_from_template_id") REFERENCES "attribut_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribut_option" ADD CONSTRAINT "attribut_option_attribut_definition_id_fkey" FOREIGN KEY ("attribut_definition_id") REFERENCES "attribut_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorie_attribut" ADD CONSTRAINT "categorie_attribut_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorie_attribut" ADD CONSTRAINT "categorie_attribut_attribut_definition_id_fkey" FOREIGN KEY ("attribut_definition_id") REFERENCES "attribut_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statut" ADD CONSTRAINT "statut_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_depot" ADD CONSTRAINT "contrat_depot_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_statut_id_fkey" FOREIGN KEY ("statut_id") REFERENCES "statut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit" ADD CONSTRAINT "produit_contrat_depot_id_fkey" FOREIGN KEY ("contrat_depot_id") REFERENCES "contrat_depot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeur_attribut" ADD CONSTRAINT "valeur_attribut_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeur_attribut" ADD CONSTRAINT "valeur_attribut_attribut_definition_id_fkey" FOREIGN KEY ("attribut_definition_id") REFERENCES "attribut_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit_attribut_option" ADD CONSTRAINT "produit_attribut_option_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produit_attribut_option" ADD CONSTRAINT "produit_attribut_option_attribut_option_id_fkey" FOREIGN KEY ("attribut_option_id") REFERENCES "attribut_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statut" ADD CONSTRAINT "historique_statut_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statut" ADD CONSTRAINT "historique_statut_statut_id_fkey" FOREIGN KEY ("statut_id") REFERENCES "statut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statut" ADD CONSTRAINT "historique_statut_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_contrat_depot_id_fkey" FOREIGN KEY ("contrat_depot_id") REFERENCES "contrat_depot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
