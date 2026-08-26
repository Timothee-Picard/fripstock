-- AlterTable
ALTER TABLE "statut" ADD COLUMN     "position_x" DOUBLE PRECISION,
ADD COLUMN     "position_y" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "transition_statut" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "cible_id" TEXT NOT NULL,

    CONSTRAINT "transition_statut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transition_statut_source_id_idx" ON "transition_statut"("source_id");

-- CreateIndex
CREATE INDEX "transition_statut_cible_id_idx" ON "transition_statut"("cible_id");

-- CreateIndex
CREATE UNIQUE INDEX "transition_statut_source_id_cible_id_key" ON "transition_statut"("source_id", "cible_id");

-- AddForeignKey
ALTER TABLE "transition_statut" ADD CONSTRAINT "transition_statut_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "statut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_statut" ADD CONSTRAINT "transition_statut_cible_id_fkey" FOREIGN KEY ("cible_id") REFERENCES "statut"("id") ON DELETE CASCADE ON UPDATE CASCADE;
