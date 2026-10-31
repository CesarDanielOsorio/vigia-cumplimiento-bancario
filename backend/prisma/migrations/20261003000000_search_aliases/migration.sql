-- La búsqueda incluye los alias y no depende de tildes ni puntuación.
ALTER TABLE "SanctionRecord" ADD COLUMN "searchNorm" TEXT NOT NULL DEFAULT '';

-- Relleno de los registros existentes (aproximación en SQL de utils/normalize.ts;
-- la siguiente sincronización los reescribe con la normalización exacta).
UPDATE "SanctionRecord" SET "searchNorm" = btrim(regexp_replace(replace(
  translate(upper(name || ' ' || array_to_string(aliases, ' ')),
            'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ', 'AAAAAAEEEEIIIIOOOOOUUUUNC'),
  '.', ''), '[^[:alnum:]]+', ' ', 'g'));

DROP INDEX IF EXISTS "SanctionRecord_nameNorm_trgm";
CREATE INDEX "SanctionRecord_searchNorm_trgm" ON "SanctionRecord" USING gin ("searchNorm" gin_trgm_ops);
