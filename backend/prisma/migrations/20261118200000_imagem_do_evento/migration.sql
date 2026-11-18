-- Imagem opcional do evento (exibida no card). Aditiva: coluna anulável + índice único + FK com SET NULL.
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "imageId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Event_imageId_key" ON "Event"("imageId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

