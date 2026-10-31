-- Búsqueda por coincidencia parcial de nombre (ILIKE '%texto%') usando índices trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "SanctionRecord_nameNorm_trgm" ON "SanctionRecord" USING gin ("nameNorm" gin_trgm_ops);
