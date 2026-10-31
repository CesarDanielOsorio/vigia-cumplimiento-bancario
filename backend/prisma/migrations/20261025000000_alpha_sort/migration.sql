-- Orden alfabético de las listas: A-Z primero, luego otros alfabetos, números y al final símbolos.
ALTER TABLE "SanctionRecord" ADD COLUMN "sortKey" TEXT NOT NULL DEFAULT '';

-- Aproximación en SQL de sortKey() (src/utils/normalize.ts); la siguiente sincronización
-- recalcula el valor exacto desde el código.
UPDATE "SanctionRecord" SET "sortKey" = CASE
    WHEN btrim(name) ~ '^[0-9]' THEN '2'
    WHEN btrim(name) ~ '^[A-Za-zÀ-ÖØ-öø-ɏ]' AND "nameNorm" ~ '^[A-Z]' THEN '0'
    WHEN btrim(name) ~ '^[[:punct:]«»“”‘’¿¡•·€£]' OR "nameNorm" = '' THEN '3'
    ELSE '1'
  END || "nameNorm";

-- El índice nuevo también cubre las consultas por (listKey, batchId).
DROP INDEX "SanctionRecord_listKey_batchId_idx";
DROP INDEX "SanctionRecord_nameNorm_idx";
CREATE INDEX "SanctionRecord_listKey_batchId_sortKey_idx" ON "SanctionRecord"("listKey", "batchId", "sortKey");
