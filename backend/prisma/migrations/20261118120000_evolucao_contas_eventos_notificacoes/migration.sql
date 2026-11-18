-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ARTIST', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ACCOUNT', 'INVITATIONS', 'APPLICATIONS', 'BOOKINGS', 'EVENTS');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventStatus" ADD VALUE 'FILLED';
ALTER TYPE "EventStatus" ADD VALUE 'POSTPONED';

-- AlterEnum
ALTER TYPE "OrganizationType" ADD VALUE 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "EquipmentCatalogItem" ADD COLUMN     "artistRequirement" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "filledAt" TIMESTAMP(3),
ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationCity" TEXT,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "locationState" CHAR(2),
ADD COLUMN     "postponedAt" TIMESTAMP(3),
ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "thumbKey" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "thumbnailUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType",
ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "avatarId" UUID,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "googleSub" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UserToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" UUID NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailInvitations" BOOLEAN NOT NULL DEFAULT true,
    "emailApplications" BOOLEAN NOT NULL DEFAULT true,
    "emailBookings" BOOLEAN NOT NULL DEFAULT true,
    "emailEvents" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" UUID NOT NULL,
    "notificationId" UUID,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserToken_userId_purpose_idx" ON "UserToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "UserToken_expiresAt_idx" ON "UserToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_notificationId_key" ON "EmailOutbox"("notificationId");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_eventId_idx" ON "Booking"("eventId");

-- CreateIndex
CREATE INDEX "Event_visibility_status_startsAt_idx" ON "Event"("visibility", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_thumbKey_key" ON "MediaAsset"("thumbKey");

-- CreateIndex
CREATE INDEX "Organization_type_name_idx" ON "Organization"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarId_key" ON "User"("avatarId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ════════════════════════════════════════════════════════════════════
-- Ajustes de dados (não destrutivos) e constraints de domínio (CHECK).
-- Os novos valores de enum (FILLED, POSTPONED, CANCELLED, INDIVIDUAL) não são usados aqui:
-- o PostgreSQL só permite usá-los após o commit desta migration.
-- ════════════════════════════════════════════════════════════════════

-- Tipo de conta das contas existentes, derivado da atuação atual. Contas sem atuação ficam NULL
-- e escolhem o tipo no próximo acesso. Vínculos existentes não são alterados.
UPDATE "User" u SET "accountType" = 'ARTIST'
WHERE EXISTS (SELECT 1 FROM "MusicianProfile" mp WHERE mp."userId" = u."id")
   OR EXISTS (SELECT 1 FROM "BandMember" bm WHERE bm."userId" = u."id" AND bm."status" = 'ACTIVE');
UPDATE "User" u SET "accountType" = 'CONTRACTOR'
WHERE u."accountType" IS NULL
  AND EXISTS (SELECT 1 FROM "OrganizationMember" om WHERE om."userId" = u."id" AND om."status" = 'ACTIVE');

-- Exigências do local não fazem parte do rider do artista (continuam disponíveis no inventário da casa).
-- Itens já gravados em riders não são apagados: ficam ocultos e saem no próximo salvamento do rider.
UPDATE "EquipmentCatalogItem" SET "artistRequirement" = false WHERE "category" = 'Palco e energia';

-- Interface totalmente em português (IDs estáveis preservados).
UPDATE "EquipmentCatalogItem" SET "category" = 'Instrumentos e amplificação' WHERE "category" = 'Backline';
UPDATE "EquipmentCatalogItem" SET "name" = 'Caixa direta (DI)' WHERE "id" = 'di';
UPDATE "EquipmentCatalogItem" SET "name" = 'Sistema de som (PA)' WHERE "id" = 'pa';
UPDATE "EquipmentCatalogItem" SET "name" = 'Retorno auricular (in-ear)' WHERE "id" = 'iem';
UPDATE "EquipmentCatalogItem" SET "name" = 'Teclado / piano digital' WHERE "id" = 'teclado';
UPDATE "EquipmentCatalogItem" SET "name" = 'Refletor de LED' WHERE "id" = 'luz';

-- Eventos sem local físico vinculado passam a ter cidade informada (requisito para eventos independentes).
UPDATE "Event" e SET "locationCity" = o."city", "locationState" = o."state"
FROM "Organization" o
WHERE e."venueId" IS NULL AND e."locationCity" IS NULL AND o."id" = e."organizerId";

ALTER TABLE "Event" ADD CONSTRAINT "Event_has_location" CHECK ("venueId" IS NOT NULL OR "locationCity" IS NOT NULL);
ALTER TABLE "User" ADD CONSTRAINT "User_failed_login_non_negative" CHECK ("failedLoginCount" >= 0);
ALTER TABLE "User" ADD CONSTRAINT "User_has_credential" CHECK (
  "anonymizedAt" IS NOT NULL OR "passwordHash" IS NOT NULL OR "googleSub" IS NOT NULL
);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_internal_link" CHECK ("link" IS NULL OR "link" LIKE '/%');
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_attempts_non_negative" CHECK ("attempts" >= 0);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_dimensions_positive" CHECK (
  ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)
);
