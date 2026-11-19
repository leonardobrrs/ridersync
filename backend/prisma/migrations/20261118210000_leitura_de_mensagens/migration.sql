-- Leitura da conversa por pessoa (contador de mensagens não lidas). Aditiva: tabela nova.
-- CreateTable
CREATE TABLE "BookingRead" (
    "bookingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRead_pkey" PRIMARY KEY ("bookingId","userId")
);

-- CreateIndex
CREATE INDEX "BookingRead_userId_idx" ON "BookingRead"("userId");

-- AddForeignKey
ALTER TABLE "BookingRead" ADD CONSTRAINT "BookingRead_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRead" ADD CONSTRAINT "BookingRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

