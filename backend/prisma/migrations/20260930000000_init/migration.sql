-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALISTA');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ANALISTA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanctionList" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastChange" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncError" TEXT,
    "batchId" TEXT,

    CONSTRAINT "SanctionList_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SanctionRecord" (
    "id" SERIAL NOT NULL,
    "entityId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNorm" TEXT NOT NULL,
    "aliases" TEXT[],
    "birthDate" TEXT,
    "countries" TEXT[],
    "identifiers" TEXT[],
    "sanctions" TEXT,
    "firstSeen" TEXT,
    "lastSeen" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanctionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "SanctionRecord_listKey_batchId_idx" ON "SanctionRecord"("listKey", "batchId");

-- CreateIndex
CREATE INDEX "SanctionRecord_nameNorm_idx" ON "SanctionRecord"("nameNorm");

-- CreateIndex
CREATE UNIQUE INDEX "SanctionRecord_listKey_batchId_entityId_key" ON "SanctionRecord"("listKey", "batchId", "entityId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanctionRecord" ADD CONSTRAINT "SanctionRecord_listKey_fkey" FOREIGN KEY ("listKey") REFERENCES "SanctionList"("key") ON DELETE CASCADE ON UPDATE CASCADE;

