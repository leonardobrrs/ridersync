-- AlterTable
ALTER TABLE "EventApplication" ADD COLUMN     "proposedFeeCents" INTEGER;

-- Contraproposta nunca negativa (mesma regra dos cachês de ofertas e eventos).
ALTER TABLE "EventApplication" ADD CONSTRAINT "EventApplication_proposed_fee_non_negative" CHECK ("proposedFeeCents" IS NULL OR "proposedFeeCents" >= 0);
