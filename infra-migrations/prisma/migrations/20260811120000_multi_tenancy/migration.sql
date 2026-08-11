-- Phase 1: Multi-tenancy core
-- Domain: *.estatecraft.io | Regions: US, EU, UAE | BYO Dial | SSO required for Pro+

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE "TenantStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDING');
CREATE TYPE "DataRegion" AS ENUM ('US', 'EU', 'UAE');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthlyUsd" INTEGER,
    "maxAgents" INTEGER,
    "maxLeads" INTEGER,
    "maxCallsPerMonth" INTEGER,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'PROVISIONING',
    "region" "DataRegion" NOT NULL DEFAULT 'US',
    "planId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "integrations" JSONB NOT NULL DEFAULT '{}',
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ssoRequired" BOOLEAN NOT NULL DEFAULT false,
    "oidcIssuer" TEXT,
    "oidcClientId" TEXT,
    "oidcClientSecret" TEXT,
    "oidcScopes" TEXT NOT NULL DEFAULT 'openid profile email',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_region_idx" ON "tenants"("region");
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");
CREATE INDEX "tenant_memberships_userId_idx" ON "tenant_memberships"("userId");

-- Seed plans (market-norm starting assumptions, USD list price)
INSERT INTO "plans" ("id", "code", "name", "priceMonthlyUsd", "maxAgents", "maxLeads", "maxCallsPerMonth", "features", "updatedAt")
VALUES
  ('plan_starter', 'STARTER', 'Starter', 79, 10, 5000, 500,
   '{"ssoEnabled":false,"ssoRequired":false,"customDomain":false,"dedicatedDb":false,"apiAccess":true,"regions":["US","EU","UAE"],"dialBringYourOwn":true}',
   CURRENT_TIMESTAMP),
  ('plan_pro', 'PRO', 'Pro', 249, 50, 50000, 5000,
   '{"ssoEnabled":true,"ssoRequired":true,"customDomain":false,"dedicatedDb":false,"apiAccess":true,"regions":["US","EU","UAE"],"dialBringYourOwn":true}',
   CURRENT_TIMESTAMP),
  ('plan_enterprise', 'ENTERPRISE', 'Enterprise', NULL, NULL, NULL, NULL,
   '{"ssoEnabled":true,"ssoRequired":true,"customDomain":true,"dedicatedDb":true,"apiAccess":true,"regions":["US","EU","UAE"],"dialBringYourOwn":true,"sla":true}',
   CURRENT_TIMESTAMP);

-- Bootstrap tenant for existing single-tenant rows
INSERT INTO "tenants" ("id", "slug", "name", "status", "region", "planId", "settings", "integrations", "ssoEnabled", "ssoRequired", "updatedAt")
VALUES (
  'tenant_summit_ridge_bootstrap',
  'summit-ridge',
  'Summit Ridge Realty',
  'ACTIVE',
  'US',
  'plan_starter',
  '{"timezone":"America/Denver","locale":"en-US"}',
  '{"dial":{"bringYourOwn":true}}',
  false,
  false,
  CURRENT_TIMESTAMP
);

-- Add tenantId columns (nullable first for backfill)
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "properties" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "leads" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "communications" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "call_records" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "voice_rules" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "lead_score_history" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "scheduled_follow_ups" ADD COLUMN "tenantId" TEXT;

UPDATE "users" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "properties" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "leads" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "communications" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "call_records" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "voice_rules" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "lead_score_history" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;
UPDATE "scheduled_follow_ups" SET "tenantId" = 'tenant_summit_ridge_bootstrap' WHERE "tenantId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "leads" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "communications" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "call_records" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "voice_rules" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "lead_score_history" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "scheduled_follow_ups" ALTER COLUMN "tenantId" SET NOT NULL;

-- FKs
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "voice_rules" ADD CONSTRAINT "voice_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_score_history" ADD CONSTRAINT "lead_score_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX "properties_tenantId_idx" ON "properties"("tenantId");
CREATE INDEX "leads_tenantId_idx" ON "leads"("tenantId");
CREATE INDEX "leads_tenantId_assignedTo_idx" ON "leads"("tenantId", "assignedTo");
CREATE INDEX "communications_tenantId_idx" ON "communications"("tenantId");
CREATE INDEX "call_records_tenantId_idx" ON "call_records"("tenantId");
CREATE INDEX "voice_rules_tenantId_idx" ON "voice_rules"("tenantId");
CREATE INDEX "lead_score_history_tenantId_idx" ON "lead_score_history"("tenantId");
CREATE INDEX "scheduled_follow_ups_tenantId_idx" ON "scheduled_follow_ups"("tenantId");

-- Backfill memberships for existing users
INSERT INTO "tenant_memberships" ("id", "tenantId", "userId", "role", "updatedAt")
SELECT 'mbr_' || "id", 'tenant_summit_ridge_bootstrap', "id", "role", CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT ("tenantId", "userId") DO NOTHING;

-- Row-Level Security (defense in depth; app sets app.tenant_id per request)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voice_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_score_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_follow_ups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;

-- Permissive policies when app.tenant_id is unset (migrations/seed as table owner);
-- when set, restrict to that tenant.
CREATE POLICY tenant_isolation_users ON "users"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_properties ON "properties"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_leads ON "leads"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_communications ON "communications"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_call_records ON "call_records"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_voice_rules ON "voice_rules"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_lead_score_history ON "lead_score_history"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_scheduled_follow_ups ON "scheduled_follow_ups"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_memberships ON "tenant_memberships"
  USING (current_setting('app.tenant_id', true) IS NULL OR current_setting('app.tenant_id', true) = '' OR "tenantId" = current_setting('app.tenant_id', true));
