-- CreateEnum
CREATE TYPE "attribute_type" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "sale_type" AS ENUM ('RESALE', 'CONSIGNMENT');

-- CreateTable
CREATE TABLE "company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_manager" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "attribute_type" NOT NULL,

    CONSTRAINT "attribute_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_template_option" (
    "id" TEXT NOT NULL,
    "attribute_template_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attribute_template_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_definition" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "attribute_type" NOT NULL,
    "cloned_from_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribute_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_option" (
    "id" TEXT NOT NULL,
    "attribute_definition_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attribute_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attribute" (
    "category_id" TEXT NOT NULL,
    "attribute_definition_id" TEXT NOT NULL,

    CONSTRAINT "category_attribute_pkey" PRIMARY KEY ("category_id","attribute_definition_id")
);

-- CreateTable
CREATE TABLE "status" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_sale" BOOLEAN NOT NULL DEFAULT false,
    "blocks_sale" BOOLEAN NOT NULL DEFAULT false,
    "leaves_stock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_transition" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,

    CONSTRAINT "status_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depositor" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "iban" TEXT,
    "default_commission" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depositor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_contract" (
    "id" TEXT NOT NULL,
    "depositor_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "commission" DECIMAL(5,2) NOT NULL,
    "notify_before_days" INTEGER NOT NULL DEFAULT 7,
    "status" "contract_status" NOT NULL DEFAULT 'ACTIVE',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shop_id" TEXT,
    "category_id" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,
    "reference" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "internal_note" TEXT,
    "photo_url" TEXT,
    "purchase_price" DECIMAL(10,2),
    "sale_price" DECIMAL(10,2),
    "sold_price" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sale_type" "sale_type" NOT NULL,
    "deposit_contract_id" TEXT,
    "applied_commission" DECIMAL(5,2),
    "depositor_paid" BOOLEAN,
    "sold_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_value" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "attribute_definition_id" TEXT NOT NULL,
    "text_value" TEXT,
    "number_value" DECIMAL(12,3),
    "boolean_value" BOOLEAN,

    CONSTRAINT "attribute_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_option" (
    "product_id" TEXT NOT NULL,
    "attribute_option_id" TEXT NOT NULL,

    CONSTRAINT "product_attribute_option_pkey" PRIMARY KEY ("product_id","attribute_option_id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "deposit_contract_id" TEXT,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shop_company_id_idx" ON "shop"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_company_id_idx" ON "user"("company_id");

-- CreateIndex
CREATE INDEX "shop_access_user_id_idx" ON "shop_access"("user_id");

-- CreateIndex
CREATE INDEX "shop_access_shop_id_idx" ON "shop_access"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_access_user_id_shop_id_key" ON "shop_access"("user_id", "shop_id");

-- CreateIndex
CREATE INDEX "category_company_id_idx" ON "category"("company_id");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_template_name_key" ON "attribute_template"("name");

-- CreateIndex
CREATE INDEX "attribute_template_option_attribute_template_id_idx" ON "attribute_template_option"("attribute_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_template_option_attribute_template_id_value_key" ON "attribute_template_option"("attribute_template_id", "value");

-- CreateIndex
CREATE INDEX "attribute_definition_company_id_idx" ON "attribute_definition"("company_id");

-- CreateIndex
CREATE INDEX "attribute_definition_cloned_from_template_id_idx" ON "attribute_definition"("cloned_from_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definition_company_id_name_key" ON "attribute_definition"("company_id", "name");

-- CreateIndex
CREATE INDEX "attribute_option_attribute_definition_id_idx" ON "attribute_option"("attribute_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_option_attribute_definition_id_value_key" ON "attribute_option"("attribute_definition_id", "value");

-- CreateIndex
CREATE INDEX "category_attribute_category_id_idx" ON "category_attribute"("category_id");

-- CreateIndex
CREATE INDEX "category_attribute_attribute_definition_id_idx" ON "category_attribute"("attribute_definition_id");

-- CreateIndex
CREATE INDEX "status_company_id_idx" ON "status"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "status_company_id_name_key" ON "status"("company_id", "name");

-- CreateIndex
CREATE INDEX "status_transition_source_id_idx" ON "status_transition"("source_id");

-- CreateIndex
CREATE INDEX "status_transition_target_id_idx" ON "status_transition"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "status_transition_source_id_target_id_key" ON "status_transition"("source_id", "target_id");

-- CreateIndex
CREATE INDEX "depositor_company_id_idx" ON "depositor"("company_id");

-- CreateIndex
CREATE INDEX "deposit_contract_depositor_id_idx" ON "deposit_contract"("depositor_id");

-- CreateIndex
CREATE INDEX "deposit_contract_end_date_idx" ON "deposit_contract"("end_date");

-- CreateIndex
CREATE INDEX "product_company_id_idx" ON "product"("company_id");

-- CreateIndex
CREATE INDEX "product_shop_id_idx" ON "product"("shop_id");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "product"("category_id");

-- CreateIndex
CREATE INDEX "product_status_id_idx" ON "product"("status_id");

-- CreateIndex
CREATE INDEX "product_deposit_contract_id_idx" ON "product"("deposit_contract_id");

-- CreateIndex
CREATE INDEX "product_reference_idx" ON "product"("reference");

-- CreateIndex
CREATE INDEX "attribute_value_product_id_idx" ON "attribute_value"("product_id");

-- CreateIndex
CREATE INDEX "attribute_value_attribute_definition_id_idx" ON "attribute_value"("attribute_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_value_product_id_attribute_definition_id_key" ON "attribute_value"("product_id", "attribute_definition_id");

-- CreateIndex
CREATE INDEX "product_attribute_option_product_id_idx" ON "product_attribute_option"("product_id");

-- CreateIndex
CREATE INDEX "product_attribute_option_attribute_option_id_idx" ON "product_attribute_option"("attribute_option_id");

-- CreateIndex
CREATE INDEX "status_history_product_id_idx" ON "status_history"("product_id");

-- CreateIndex
CREATE INDEX "status_history_status_id_idx" ON "status_history"("status_id");

-- CreateIndex
CREATE INDEX "status_history_changed_by_user_id_idx" ON "status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "notification_company_id_idx" ON "notification"("company_id");

-- CreateIndex
CREATE INDEX "notification_deposit_contract_id_idx" ON "notification"("deposit_contract_id");

-- AddForeignKey
ALTER TABLE "shop" ADD CONSTRAINT "shop_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_access" ADD CONSTRAINT "shop_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_access" ADD CONSTRAINT "shop_access_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_template_option" ADD CONSTRAINT "attribute_template_option_attribute_template_id_fkey" FOREIGN KEY ("attribute_template_id") REFERENCES "attribute_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_definition" ADD CONSTRAINT "attribute_definition_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_definition" ADD CONSTRAINT "attribute_definition_cloned_from_template_id_fkey" FOREIGN KEY ("cloned_from_template_id") REFERENCES "attribute_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_option" ADD CONSTRAINT "attribute_option_attribute_definition_id_fkey" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_attribute_definition_id_fkey" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status" ADD CONSTRAINT "status_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transition" ADD CONSTRAINT "status_transition_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transition" ADD CONSTRAINT "status_transition_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depositor" ADD CONSTRAINT "depositor_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_contract" ADD CONSTRAINT "deposit_contract_depositor_id_fkey" FOREIGN KEY ("depositor_id") REFERENCES "depositor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_deposit_contract_id_fkey" FOREIGN KEY ("deposit_contract_id") REFERENCES "deposit_contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_attribute_definition_id_fkey" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_option" ADD CONSTRAINT "product_attribute_option_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_option" ADD CONSTRAINT "product_attribute_option_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_deposit_contract_id_fkey" FOREIGN KEY ("deposit_contract_id") REFERENCES "deposit_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
