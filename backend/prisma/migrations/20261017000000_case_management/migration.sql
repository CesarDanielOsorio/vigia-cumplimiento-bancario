-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('PENDIENTE', 'EN_INVESTIGACION', 'EN_DECISION', 'ARCHIVADO', 'REPORTADO');

-- CreateTable
CREATE TABLE "RiskCase" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'PENDIENTE',
    "assignedToId" INTEGER,
    "recommendation" TEXT,
    "recommendationNote" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "rtsNumber" TEXT,
    "enhancedMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "nextReviewAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseActivity" (
    "id" SERIAL NOT NULL,
    "caseId" INTEGER NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskCase_eventId_key" ON "RiskCase"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCase_rtsNumber_key" ON "RiskCase"("rtsNumber");

-- CreateIndex
CREATE INDEX "RiskCase_status_idx" ON "RiskCase"("status");

-- CreateIndex
CREATE INDEX "CaseActivity_caseId_idx" ON "CaseActivity"("caseId");

-- AddForeignKey
ALTER TABLE "RiskCase" ADD CONSTRAINT "RiskCase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RiskEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCase" ADD CONSTRAINT "RiskCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCase" ADD CONSTRAINT "RiskCase_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseActivity" ADD CONSTRAINT "CaseActivity_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RiskCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseActivity" ADD CONSTRAINT "CaseActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Abre un caso pendiente para cada evento que ya existía.
INSERT INTO "RiskCase" ("eventId", "createdAt", "updatedAt")
SELECT "id", "createdAt", CURRENT_TIMESTAMP FROM "RiskEvent";

INSERT INTO "CaseActivity" ("caseId", "userId", "action", "note", "createdAt")
SELECT c."id", e."createdById", 'CREADO', 'Evento registrado en la matriz; caso abierto pendiente de asignación.', e."createdAt"
FROM "RiskCase" c JOIN "RiskEvent" e ON e."id" = c."eventId";
