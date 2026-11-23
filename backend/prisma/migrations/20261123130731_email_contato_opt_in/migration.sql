-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "showContactEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "showContactEmail" BOOLEAN NOT NULL DEFAULT false;
