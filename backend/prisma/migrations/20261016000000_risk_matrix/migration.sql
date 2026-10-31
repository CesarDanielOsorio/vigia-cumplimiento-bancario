-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('PROPUESTA', 'APROBADA', 'RECHAZADA');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AUDITOR';

-- CreateTable
CREATE TABLE "WeightVersion" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'PROPUESTA',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "WeightVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "scores" JSONB NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAdjustment" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "RiskAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeightVersion_version_key" ON "WeightVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RiskEvent_code_key" ON "RiskEvent"("code");

-- AddForeignKey
ALTER TABLE "WeightVersion" ADD CONSTRAINT "WeightVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightVersion" ADD CONSTRAINT "WeightVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskEvent" ADD CONSTRAINT "RiskEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAdjustment" ADD CONSTRAINT "RiskAdjustment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RiskEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

