-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'AGENT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'ENGAGED', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'COLD_CALL', 'REFERRAL', 'SOCIAL_MEDIA', 'EMAIL_CAMPAIGN', 'TRADE_SHOW', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'PENDING', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('VOICE', 'SMS', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'QUEUED', 'INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'BUSY', 'FAILED', 'VOICEMAIL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'SKIPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "propertyType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "zipCode" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "squareFootage" DOUBLE PRECISION,
    "features" TEXT[],
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "listingAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL,
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "propertyId" TEXT,
    "propertyType" TEXT,
    "priceMin" DOUBLE PRECISION,
    "priceMax" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "qualificationScore" INTEGER NOT NULL DEFAULT 0,
    "aiConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "assignedTo" TEXT,
    "tags" TEXT[],
    "notes" TEXT[],
    "nextFollowUp" TIMESTAMP(3),
    "cadence" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'OUTBOUND',
    "status" "CommunicationStatus" NOT NULL DEFAULT 'PENDING',
    "content" TEXT,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "metadata" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_records" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "externalCallId" TEXT,
    "duration" INTEGER,
    "outcome" "CallOutcome",
    "transcript" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minQualificationScore" INTEGER NOT NULL DEFAULT 70,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMinutes" INTEGER NOT NULL DEFAULT 30,
    "smsFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsFallbackTemplate" TEXT,
    "outboundInstruction" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_score_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "factors" JSONB NOT NULL,
    "trigger" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_follow_ups" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "communications_leadId_idx" ON "communications"("leadId");

-- CreateIndex
CREATE INDEX "communications_status_idx" ON "communications"("status");

-- CreateIndex
CREATE INDEX "communications_channel_idx" ON "communications"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "call_records_communicationId_key" ON "call_records"("communicationId");

-- CreateIndex
CREATE INDEX "lead_score_history_leadId_idx" ON "lead_score_history"("leadId");

-- CreateIndex
CREATE INDEX "scheduled_follow_ups_leadId_idx" ON "scheduled_follow_ups"("leadId");

-- CreateIndex
CREATE INDEX "scheduled_follow_ups_scheduledAt_idx" ON "scheduled_follow_ups"("scheduledAt");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_listingAgentId_fkey" FOREIGN KEY ("listingAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "communications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_score_history" ADD CONSTRAINT "lead_score_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

