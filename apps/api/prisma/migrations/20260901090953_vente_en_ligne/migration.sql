-- AlterTable
ALTER TABLE "product" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "online_price" DECIMAL(10,2),
ADD COLUMN     "pending_removal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "status" ADD COLUMN     "is_online_sale" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "product_is_online_idx" ON "product"("is_online");

-- CreateIndex
CREATE INDEX "product_pending_removal_idx" ON "product"("pending_removal");
