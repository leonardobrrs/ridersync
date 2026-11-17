-- CreateEnum
CREATE TYPE "ArtistKind" AS ENUM ('SOLO', 'BAND');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "BandRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'DECLINED', 'CANCELLED', 'REMOVED', 'LEFT');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('VENUE');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PortfolioKind" AS ENUM ('AUDIO', 'VIDEO', 'PHOTO', 'DOCUMENT', 'LINK');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BookingOrigin" AS ENUM ('DIRECT', 'APPLICATION');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NEGOTIATING', 'AGREED', 'CONFIRMED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingSide" AS ENUM ('VENUE', 'ARTIST');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" UUID NOT NULL,
    "kind" "ArtistKind" NOT NULL,
    "musicianProfileId" UUID,
    "bandId" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "city" TEXT,
    "state" CHAR(2) NOT NULL DEFAULT 'AL',
    "genres" TEXT[],
    "formats" TEXT[],
    "careerStartYear" INTEGER,
    "baseFeeCents" INTEGER,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "photoId" UUID,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicianProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mainInstrument" TEXT,
    "instruments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Band" (
    "id" UUID NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Band_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandMember" (
    "id" UUID NOT NULL,
    "bandId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "BandRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL,
    "instrument" TEXT,
    "invitedById" UUID,
    "invitedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BandMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'VENUE',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venueKind" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "addressLine" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL DEFAULT 'AL',
    "capacity" INTEGER,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "photoId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "OrgRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL,
    "invitedById" UUID,
    "invitedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" UUID NOT NULL,
    "artistId" UUID NOT NULL,
    "kind" "PortfolioKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "mediaId" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EquipmentCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalRider" (
    "id" UUID NOT NULL,
    "artistId" UUID NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalRider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderItem" (
    "id" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "catalogItemId" TEXT,
    "customName" TEXT,
    "customUnit" TEXT,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueEquipmentItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "organizationType" "OrganizationType" NOT NULL DEFAULT 'VENUE',
    "catalogItemId" TEXT,
    "customName" TEXT,
    "customUnit" TEXT,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueEquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "organizerId" UUID NOT NULL,
    "venueId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "slots" INTEGER NOT NULL,
    "genres" TEXT[],
    "paymentType" TEXT,
    "feeCents" INTEGER,
    "conditions" TEXT NOT NULL DEFAULT '',
    "requirements" TEXT NOT NULL DEFAULT '',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventApplication" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "artistId" UUID NOT NULL,
    "submittedById" UUID,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "decisionNote" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "origin" "BookingOrigin" NOT NULL,
    "organizationId" UUID NOT NULL,
    "artistId" UUID NOT NULL,
    "eventId" UUID,
    "applicationId" UUID,
    "title" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'NEGOTIATING',
    "createdById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingOffer" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "authorId" UUID,
    "authorSide" "BookingSide" NOT NULL,
    "previousOfferId" UUID,
    "performanceAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "terms" TEXT NOT NULL DEFAULT '',
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "respondedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingMessage" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "authorId" UUID,
    "authorSide" "BookingSide" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusChange" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "actorId" UUID,
    "actorSide" "BookingSide",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "artistId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "registeredById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_musicianProfileId_key" ON "Artist"("musicianProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_bandId_key" ON "Artist"("bandId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_photoId_key" ON "Artist"("photoId");

-- CreateIndex
CREATE INDEX "Artist_visibility_kind_idx" ON "Artist"("visibility", "kind");

-- CreateIndex
CREATE INDEX "Artist_city_idx" ON "Artist"("city");

-- CreateIndex
CREATE UNIQUE INDEX "MusicianProfile_userId_key" ON "MusicianProfile"("userId");

-- CreateIndex
CREATE INDEX "BandMember_userId_status_idx" ON "BandMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BandMember_bandId_userId_key" ON "BandMember"("bandId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_photoId_key" ON "Organization"("photoId");

-- CreateIndex
CREATE INDEX "Organization_city_idx" ON "Organization"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_type_key" ON "Organization"("id", "type");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_status_idx" ON "OrganizationMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_mediaId_key" ON "PortfolioItem"("mediaId");

-- CreateIndex
CREATE INDEX "PortfolioItem_artistId_position_idx" ON "PortfolioItem"("artistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalRider_artistId_key" ON "TechnicalRider"("artistId");

-- CreateIndex
CREATE INDEX "RiderItem_riderId_idx" ON "RiderItem"("riderId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderItem_riderId_catalogItemId_key" ON "RiderItem"("riderId", "catalogItemId");

-- CreateIndex
CREATE INDEX "VenueEquipmentItem_organizationId_idx" ON "VenueEquipmentItem"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueEquipmentItem_organizationId_catalogItemId_key" ON "VenueEquipmentItem"("organizationId", "catalogItemId");

-- CreateIndex
CREATE INDEX "Event_status_applicationDeadline_idx" ON "Event"("status", "applicationDeadline");

-- CreateIndex
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");

-- CreateIndex
CREATE INDEX "EventApplication_artistId_idx" ON "EventApplication"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "EventApplication_eventId_artistId_key" ON "EventApplication"("eventId", "artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_applicationId_key" ON "Booking"("applicationId");

-- CreateIndex
CREATE INDEX "Booking_organizationId_status_idx" ON "Booking"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Booking_artistId_status_idx" ON "Booking"("artistId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BookingOffer_previousOfferId_key" ON "BookingOffer"("previousOfferId");

-- CreateIndex
CREATE INDEX "BookingOffer_bookingId_createdAt_idx" ON "BookingOffer"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingMessage_bookingId_createdAt_idx" ON "BookingMessage"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingStatusChange_bookingId_createdAt_idx" ON "BookingStatusChange"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Performance_bookingId_key" ON "Performance"("bookingId");

-- CreateIndex
CREATE INDEX "Performance_artistId_performedAt_idx" ON "Performance"("artistId", "performedAt");

-- CreateIndex
CREATE INDEX "Performance_organizationId_performedAt_idx" ON "Performance"("organizationId", "performedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_musicianProfileId_fkey" FOREIGN KEY ("musicianProfileId") REFERENCES "MusicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicianProfile" ADD CONSTRAINT "MusicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Band" ADD CONSTRAINT "Band_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandMember" ADD CONSTRAINT "BandMember_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "Band"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandMember" ADD CONSTRAINT "BandMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandMember" ADD CONSTRAINT "BandMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalRider" ADD CONSTRAINT "TechnicalRider_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderItem" ADD CONSTRAINT "RiderItem_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "TechnicalRider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderItem" ADD CONSTRAINT "RiderItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "EquipmentCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueEquipmentItem" ADD CONSTRAINT "VenueEquipmentItem_organizationId_organizationType_fkey" FOREIGN KEY ("organizationId", "organizationType") REFERENCES "Organization"("id", "type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueEquipmentItem" ADD CONSTRAINT "VenueEquipmentItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "EquipmentCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventApplication" ADD CONSTRAINT "EventApplication_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventApplication" ADD CONSTRAINT "EventApplication_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventApplication" ADD CONSTRAINT "EventApplication_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventApplication" ADD CONSTRAINT "EventApplication_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "EventApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_previousOfferId_fkey" FOREIGN KEY ("previousOfferId") REFERENCES "BookingOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusChange" ADD CONSTRAINT "BookingStatusChange_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusChange" ADD CONSTRAINT "BookingStatusChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════
-- Constraints de domínio não expressáveis no schema Prisma (CHECK).
-- ════════════════════════════════════════════════════════════════════

-- Artist referencia exatamente UM subtipo e o kind é coerente com ele.
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_exactly_one_subtype" CHECK (
  ("kind" = 'SOLO' AND "musicianProfileId" IS NOT NULL AND "bandId" IS NULL)
  OR ("kind" = 'BAND' AND "bandId" IS NOT NULL AND "musicianProfileId" IS NULL)
);
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_fee_non_negative" CHECK ("baseFeeCents" IS NULL OR "baseFeeCents" >= 0);

-- Portfólio: link externo OU arquivo enviado.
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_url_xor_media" CHECK (num_nonnulls("url", "mediaId") = 1);

-- Itens de rider/inventário: catalogado OU personalizado.
ALTER TABLE "RiderItem" ADD CONSTRAINT "RiderItem_catalog_xor_custom" CHECK (num_nonnulls("catalogItemId", "customName") = 1);
ALTER TABLE "RiderItem" ADD CONSTRAINT "RiderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "VenueEquipmentItem" ADD CONSTRAINT "VenueEquipmentItem_catalog_xor_custom" CHECK (num_nonnulls("catalogItemId", "customName") = 1);
ALTER TABLE "VenueEquipmentItem" ADD CONSTRAINT "VenueEquipmentItem_quantity_non_negative" CHECK ("quantity" >= 0);
-- Inventário só pertence a organização do tipo VENUE (FK composta (organizationId, organizationType)).
ALTER TABLE "VenueEquipmentItem" ADD CONSTRAINT "VenueEquipmentItem_venue_only" CHECK ("organizationType" = 'VENUE');

-- Eventos
ALTER TABLE "Event" ADD CONSTRAINT "Event_slots_positive" CHECK ("slots" > 0);
ALTER TABLE "Event" ADD CONSTRAINT "Event_deadline_before_start" CHECK ("applicationDeadline" <= "startsAt");
ALTER TABLE "Event" ADD CONSTRAINT "Event_fee_non_negative" CHECK ("feeCents" IS NULL OR "feeCents" >= 0);

-- Booking: origem APPLICATION ⇔ applicationId presente.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_origin_matches_application" CHECK (
  ("origin" = 'APPLICATION' AND "applicationId" IS NOT NULL) OR ("origin" = 'DIRECT' AND "applicationId" IS NULL)
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmed_has_audit" CHECK (
  "status" <> 'CONFIRMED' OR ("confirmedAt" IS NOT NULL)
);
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_fee_non_negative" CHECK ("feeCents" >= 0);
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_duration_positive" CHECK ("durationMinutes" > 0);

-- ════════════════════════════════════════════════════════════════════
-- Catálogo técnico de referência (IDs estáveis). Dado de referência necessário
-- em todos os ambientes — NÃO é dado de demonstração.
-- ════════════════════════════════════════════════════════════════════
INSERT INTO "EquipmentCatalogItem" ("id", "name", "unit", "category", "sortOrder") VALUES
  ('mic-din',   'Microfone dinâmico',        'un',     'Áudio', 10),
  ('mic-cond',  'Microfone condensador',     'un',     'Áudio', 20),
  ('mic-sf',    'Microfone sem fio',         'un',     'Áudio', 30),
  ('di',        'Direct box (DI)',           'un',     'Áudio', 40),
  ('mesa',      'Mesa de som',               'canais', 'Áudio', 50),
  ('pa',        'Sistema de PA',             'par',    'Áudio', 60),
  ('retorno',   'Monitor de retorno',        'un',     'Áudio', 70),
  ('iem',       'Sistema in-ear',            'vias',   'Áudio', 80),
  ('pedestal',  'Pedestal de microfone',     'un',     'Áudio', 90),
  ('xlr',       'Cabo XLR',                  'un',     'Áudio', 100),
  ('bateria',   'Bateria completa',          'kit',    'Backline', 110),
  ('amp-baixo', 'Amplificador de baixo',     'un',     'Backline', 120),
  ('amp-gtr',   'Amplificador de guitarra',  'un',     'Backline', 130),
  ('teclado',   'Teclado / stage piano',     'un',     'Backline', 140),
  ('sup-tec',   'Suporte de teclado',        'un',     'Backline', 150),
  ('banqueta',  'Banqueta',                  'un',     'Backline', 160),
  ('palco',     'Área de palco',             'm²',     'Palco e energia', 170),
  ('energia',   'Ponto de energia 220V',     'pontos', 'Palco e energia', 180),
  ('luz',       'Refletor PAR LED',          'un',     'Palco e energia', 190),
  ('camarim',   'Camarim',                   'sala',   'Palco e energia', 200);
