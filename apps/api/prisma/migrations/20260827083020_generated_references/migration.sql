-- Références d'articles générées : A-0042 pour un achat, D-MAR-001 pour un dépôt.
--
-- Les deux compteurs sont incrémentés par la base dans la transaction de
-- création : deux employés qui enregistrent au même moment obtiennent deux
-- numéros, là où un `max + 1` lu puis réécrit leur donnerait le même.

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "product_counter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "depositor" ADD COLUMN     "code" TEXT,
ADD COLUMN     "product_counter" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "depositor_company_id_code_key" ON "depositor"("company_id", "code");

-- Une référence identifie physiquement un article : deux étiquettes identiques
-- dans la même entreprise sont une erreur. Postgres accepte plusieurs NULL, un
-- article sans référence reste donc possible.
-- CreateIndex
CREATE UNIQUE INDEX "product_company_id_reference_key" ON "product"("company_id", "reference");
