-- CreateTable
CREATE TABLE "PricingChatRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "routeDirection" TEXT NOT NULL,
    "source" TEXT,
    "destination" TEXT,
    "journeyDate" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dayType" TEXT,
    "demandScore" REAL,
    "festivalFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PricingChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "messageText" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PricingChatRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingInstruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "routeId" TEXT,
    "routeDirection" TEXT,
    "journeyDate" TEXT,
    "serviceId" TEXT,
    "serviceNumber" TEXT,
    "timeBand" TEXT,
    "instructionText" TEXT NOT NULL,
    "instructionJson" TEXT NOT NULL,
    "instructionType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PricingInstruction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PricingChatRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingInstructionUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructionId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceNumber" TEXT,
    "decisionId" TEXT,
    "cycleId" TEXT,
    "usageReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingInstructionUsage_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "PricingInstruction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingChangeBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "cycleId" TEXT,
    "routeId" TEXT,
    "routeDirection" TEXT,
    "journeyDate" TEXT,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    "increaseCount" INTEGER NOT NULL DEFAULT 0,
    "decreaseCount" INTEGER NOT NULL DEFAULT 0,
    "classificationChangeCount" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "summaryText" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingChangeBatch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PricingChatRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingChangeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceNumber" TEXT,
    "serviceName" TEXT,
    "departureTime" TEXT,
    "beforeClassification" TEXT,
    "afterClassification" TEXT,
    "beforeBusAdjPct" REAL,
    "afterBusAdjPct" REAL,
    "beforeEffectiveFare" REAL,
    "afterEffectiveFare" REAL,
    "beforeOccupancy" REAL,
    "afterOccupancy" REAL,
    "reasonToChange" TEXT NOT NULL,
    "instructionUsed" TEXT,
    "instructionId" TEXT,
    "agentConfidence" REAL,
    "riskLevel" TEXT,
    "guardrailStatus" TEXT,
    "writerStatus" TEXT,
    "writerResponse" TEXT NOT NULL DEFAULT '{}',
    "changedBy" TEXT,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingChangeItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PricingChangeBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingChatRoom_routeId_routeDirection_journeyDate_key" ON "PricingChatRoom"("routeId", "routeDirection", "journeyDate");
