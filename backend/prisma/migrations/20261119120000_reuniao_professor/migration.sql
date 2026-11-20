-- Reunião 19/11: evento oculto, necessidades técnicas na candidatura e avaliações pós-show. Aditiva.
-- AlterEnum
ALTER TYPE "EventVisibility" ADD VALUE 'HIDDEN';

-- AlterTable
ALTER TABLE "EventApplication" ADD COLUMN     "needs" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "authorSide" "BookingSide" NOT NULL,
    "authorId" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_authorSide_key" ON "Review"("bookingId", "authorSide");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Nota de 0 a 5 estrelas
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 0 AND 5);
-- Necessidades sempre como lista JSON
ALTER TABLE "EventApplication" ADD CONSTRAINT "EventApplication_needs_array" CHECK (jsonb_typeof("needs") = 'array');
