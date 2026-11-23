-- Rider = o que o artista PRECISA para tocar. Novo: quanto de cada item ele já possui e leva (aditiva, não destrutiva).
-- A comparação com a casa soma o que o artista leva ao que a casa tem.
ALTER TABLE "RiderItem" ADD COLUMN "ownedQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RiderItem" ADD CONSTRAINT "RiderItem_owned_within_quantity" CHECK ("ownedQuantity" >= 0 AND "ownedQuantity" <= "quantity");

-- EventApplication.needs (reunião de 19/11) foi descontinuada: o rider passou a ser a fonte das necessidades.
-- A coluna é mantida (sem apagar dados), porém não é mais lida nem gravada pela aplicação.
COMMENT ON COLUMN "EventApplication"."needs" IS 'DEPRECATED: não usada; as necessidades vêm de TechnicalRider/RiderItem.';
