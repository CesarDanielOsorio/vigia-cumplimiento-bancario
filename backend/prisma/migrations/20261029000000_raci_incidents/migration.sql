-- Roles del equipo del proyecto (RACI), seguimiento de datos incorrectos y configuracion del sistema.
-- Reemplaza el seguimiento de casos (RiskCase/CaseActivity).

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REGISTRADA', 'DIAGNOSTICADA', 'CORREGIDA', 'REVALIDADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "IncidentCause" AS ENUM ('CAPTURA', 'REGLA', 'CALCULO');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'LIDER', 'ANALISTA_RIESGO', 'ANALISTA_DATOS', 'DESARROLLADOR_BI', 'AUDITOR');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ((CASE "role"::text WHEN 'ANALISTA' THEN 'ANALISTA_RIESGO' ELSE "role"::text END)::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ANALISTA_RIESGO';
COMMIT;

-- DropForeignKey
ALTER TABLE "CaseActivity" DROP CONSTRAINT "CaseActivity_caseId_fkey";

-- DropForeignKey
ALTER TABLE "CaseActivity" DROP CONSTRAINT "CaseActivity_userId_fkey";

-- DropForeignKey
ALTER TABLE "RiskCase" DROP CONSTRAINT "RiskCase_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "RiskCase" DROP CONSTRAINT "RiskCase_decidedById_fkey";

-- DropForeignKey
ALTER TABLE "RiskCase" DROP CONSTRAINT "RiskCase_eventId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ANALISTA_RIESGO';

-- DropTable
DROP TABLE "CaseActivity";

-- DropTable
DROP TABLE "RiskCase";

-- DropEnum
DROP TYPE "CaseStatus";

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxFailedAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockMinutes" INTEGER NOT NULL DEFAULT 15,
    "listStaleHours" INTEGER NOT NULL DEFAULT 48,
    "incidentSlaDays" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataIncident" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "factor" TEXT,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REGISTRADA',
    "detectedById" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "residualBefore" DOUBLE PRECISION NOT NULL,
    "rankBefore" INTEGER NOT NULL,
    "rankingBefore" JSONB NOT NULL,
    "cause" "IncidentCause",
    "diagnosis" TEXT,
    "diagnosedById" INTEGER,
    "correction" TEXT,
    "correctedById" INTEGER,
    "scoreChange" JSONB,
    "versionId" INTEGER,
    "residualAfter" DOUBLE PRECISION,
    "rankAfter" INTEGER,
    "orderImpact" BOOLEAN,
    "revalidation" TEXT,
    "revalidatedById" INTEGER,
    "sponsorNote" TEXT,
    "sponsorInformedById" INTEGER,
    "sponsorInformedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "approvedById" INTEGER,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "DataIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentActivity" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "userId" INTEGER,
    "step" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataIncident_code_key" ON "DataIncident"("code");

-- CreateIndex
CREATE INDEX "DataIncident_status_idx" ON "DataIncident"("status");

-- CreateIndex
CREATE INDEX "IncidentActivity_incidentId_idx" ON "IncidentActivity"("incidentId");

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RiskEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_diagnosedById_fkey" FOREIGN KEY ("diagnosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WeightVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_revalidatedById_fkey" FOREIGN KEY ("revalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_sponsorInformedById_fkey" FOREIGN KEY ("sponsorInformedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIncident" ADD CONSTRAINT "DataIncident_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentActivity" ADD CONSTRAINT "IncidentActivity_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "DataIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentActivity" ADD CONSTRAINT "IncidentActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fila unica de configuracion con los valores por defecto.
INSERT INTO "SystemConfig" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);

-- El administrador es del sistema, no el oficial de cumplimiento.
UPDATE "User" SET "fullName" = 'Administrador del Sistema' WHERE "username" = 'admin' AND "fullName" = 'Administrador de Cumplimiento';
