-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "rg" TEXT;

-- AlterTable
ALTER TABLE "Band" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "legalName" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "legalName" TEXT;

-- AlterTable
ALTER TABLE "BookingOffer" ADD COLUMN     "advanceMinutes" INTEGER,
ADD COLUMN     "balanceDueDate" DATE,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "presentationDesc" TEXT,
ADD COLUMN     "rescissionDays" INTEGER,
ADD COLUMN     "signalCents" INTEGER,
ADD COLUMN     "signalDueDate" DATE,
ADD COLUMN     "substitutionDays" INTEGER;

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "templateType" "OrganizationType" NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_bookingId_key" ON "Contract"("bookingId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Constraints que o Prisma não expressa. Documentos guardados normalizados (somente dígitos) pela API.
ALTER TABLE "User" ADD CONSTRAINT "User_cpf_format" CHECK ("cpf" IS NULL OR "cpf" ~ '^[0-9]{11}$');
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_cnpj_format" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9]{14}$');
ALTER TABLE "Band" ADD CONSTRAINT "Band_cnpj_format" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9]{14}$');

-- Termos de contrato da oferta: sinal não pode exceder o cachê; prazos em faixas sensatas.
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_signal_range" CHECK ("signalCents" IS NULL OR ("signalCents" >= 0 AND "signalCents" <= "feeCents"));
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_advance_range" CHECK ("advanceMinutes" IS NULL OR ("advanceMinutes" >= 0 AND "advanceMinutes" <= 1440));
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_rescission_range" CHECK ("rescissionDays" IS NULL OR ("rescissionDays" >= 0 AND "rescissionDays" <= 365));
ALTER TABLE "BookingOffer" ADD CONSTRAINT "BookingOffer_substitution_range" CHECK ("substitutionDays" IS NULL OR ("substitutionDays" >= 0 AND "substitutionDays" <= 365));

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_content_not_empty" CHECK (length("content") > 0);
