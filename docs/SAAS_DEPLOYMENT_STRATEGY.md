# EstateCraft SaaS Deployment Strategy

**Audience:** Solution architects, engineering leads, and product owners  
**Status:** Assessment & roadmap (August 2026)  
**Purpose:** Evaluate EstateCraft's readiness to onboard paying customers as a multi-tenant SaaS product deployable across cloud providers, and define the work required to get there.

---

## Executive Summary

EstateCraft is a well-structured **monorepo** with a clean provider abstraction for voice/SMS and a working demo around a single fictional brokerage (Summit Ridge Realty). It is **not yet a multi-tenant SaaS product**. Today it can be deployed as a **single-tenant application** to Vercel + external Postgres, or run locally via Docker Compose for infrastructure only.

| Question | Answer |
|----------|--------|
| Is multi-tenancy built in? | **No.** No tenant model, no data isolation, no per-tenant configuration. |
| Is it cloud-agnostic today? | **Partially.** App code is portable Node/Postgres; deployment is Vercel-centric with no IaC or K8s. |
| Can we onboard 3 paying clients tomorrow? | **No.** Each client would share the same data and global voice config. |
| What is the fastest path to SaaS? | Shared-database multi-tenancy with `tenantId` on all domain tables, tenant context middleware, unified DB-backed auth, and a provisioning API. |

**Recommendation:** Treat EstateCraft as **SaaS-ready architecture, single-tenant implementation**. The provider pattern (`IVoiceProvider`) and service boundaries are good foundations. The gap is entirely in **tenant identity, isolation, provisioning, billing, and production operations**.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Client Onboarding Scenarios](#2-client-onboarding-scenarios)
3. [Target SaaS Architecture](#3-target-saas-architecture)
4. [Multi-Tenancy Strategy](#4-multi-tenancy-strategy)
5. [Cloud Portability Strategy](#5-cloud-portability-strategy)
6. [Gap Analysis & Required Artifacts](#6-gap-analysis--required-artifacts)
7. [Phased Implementation Roadmap](#7-phased-implementation-roadmap)
8. [Decision Log](#8-decision-log)
9. [Interactive Implementation Guide](#9-interactive-implementation-guide)

---

## 1. Current State Assessment

### 1.1 What Exists Today

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT DEPLOYMENT MODEL                     │
├─────────────────────────────────────────────────────────────────┤
│  webapp-dashboard (React/Vite)                                   │
│       │                                                          │
│       ▼                                                          │
│  svc-api (Express) ──► PostgreSQL (single shared schema)         │
│       │                                                          │
│       ├── svc-engagement (lib) ──► Dial / Mock / Twilio stub   │
│       └── svc-qualifier (lib)                                    │
│                                                                  │
│  svc-auth (separate process, mock users — not used on Vercel)   │
│                                                                  │
│  Infra: Docker Compose → Postgres, RabbitMQ, Redis (local only)  │
│  Prod:  Vercel serverless + external Postgres                    │
└─────────────────────────────────────────────────────────────────┘
```

| Capability | Status | Notes |
|------------|--------|-------|
| Monorepo structure | ✅ Solid | `pnpm` workspaces, clear package boundaries |
| Provider abstraction | ✅ Solid | `IVoiceProvider` — swap Dial/Twilio/mock via env |
| REST API + dashboard | ✅ Working | Leads, properties, voice rules, communications |
| JWT authentication | ✅ Phase 0 | DB-backed login against Prisma `User` |
| RBAC (`ADMIN`/`MANAGER`/`AGENT`) | ✅ Phase 0 | Enforced on voice rules + batch qualify; agent lead scoping |
| Database schema | ⚠️ Single-tenant | No `tenantId` on any table |
| Versioned migrations | ✅ Phase 0 | `prisma migrate deploy` + initial migration |
| Per-tenant config | ❌ Missing | Voice provider, Dial keys, rules are global |
| Billing / subscriptions | ❌ Missing | No Stripe, plans, or usage metering |
| CI/CD | ❌ Missing | No GitHub Actions workflows |
| Containerized apps | ❌ Missing | Docker Compose runs infra only, not services |
| IaC (Terraform/Pulumi) | ❌ Missing | No cloud modules |
| Kubernetes | ❌ Missing | Listed in `docs/FUTURE_ENHANCEMENTS.md` only |
| Observability | ❌ Missing | No structured tenant-aware logging/tracing |
| Message bus | ⚠️ Declared | RabbitMQ client exists; skipped on Vercel (`SKIP_INFRA`) |

### 1.2 Critical Code Gaps

**No tenant scoping in API routes.** All authenticated users see all data:

```typescript
// svc-api/src/routes/leads.ts — typical pattern today
const leads = await prisma.lead.findMany({ where: { status, priority } });
// No tenantId filter, no agent-scoped access
```

**Auth is disconnected from the database.** Login uses hardcoded demo users in both `svc-auth` and `svc-api`, while Prisma `User` records from seed are never queried.

**JWT carries no tenant context:**

```typescript
// svc-api/src/middleware/auth.ts
req.user = { id, email, role };
// Missing: tenantId, tenantSlug, permissions
```

**Global voice configuration.** `VOICE_PROVIDER`, `DIAL_API_KEY`, and `VoiceRule` records apply to the entire platform — unacceptable for SaaS where each brokerage brings their own Dial account.

### 1.3 What the Roadmap Already Acknowledges

From `docs/FUTURE_ENHANCEMENTS.md`:

- Multi-tenant — agency-level isolation
- Kubernetes deployment
- CI/CD pipeline
- Rate limiting per tenant

These are correctly identified but **not started**.

---

## 2. Client Onboarding Scenarios

Imagine three paying customers onboard tomorrow. Here is what each needs and what EstateCraft can deliver today.

### 2.1 Startup Client (e.g., 5 agents, 1 office)

| Need | Today | Target |
|------|-------|--------|
| Own branded subdomain (`acme.estatecraft.io`) | ❌ | Tenant slug + DNS |
| Isolated leads & properties | ❌ | `tenantId` row-level isolation |
| Own Dial API key / phone number | ❌ | Per-tenant integration config |
| Self-serve signup + credit card | ❌ | Stripe Checkout + provisioning |
| Low ops overhead | ✅ Vercel works | Shared infra, pooled DB |
| Time to onboard | **Weeks of custom work** | **< 1 hour automated** |

**Isolation model:** Shared database, shared app deployment. Lowest cost, fastest to ship.

### 2.2 SME Client (e.g., 50 agents, 3 offices)

| Need | Today | Target |
|------|-------|--------|
| Multiple teams / offices | ❌ | `Team` or `Office` sub-entity under tenant |
| Manager vs agent data scoping | ❌ | RBAC enforcement + `assignedTo` filters |
| Custom voice rules per office | ❌ | Tenant-scoped `VoiceRule` |
| SSO (Google Workspace / Azure AD) | ❌ | OIDC/SAML via Auth0 or Clerk |
| Usage reporting | ❌ | Per-tenant metrics dashboard |
| SLA / support tier | ❌ | Plan-based feature flags |
| Time to onboard | **Not possible** | **< 1 day with admin-assisted provisioning** |

**Isolation model:** Shared database with strict middleware enforcement. Optional dedicated schema for compliance-sensitive SMEs.

### 2.3 Enterprise Client (e.g., 500+ agents, compliance requirements)

| Need | Today | Target |
|------|-------|--------|
| Data residency (EU/US) | ❌ | Region-specific deployment + DB |
| Dedicated infrastructure | ❌ | Single-tenant deployment option |
| Custom domain (`crm.bigbroker.com`) | ❌ | Custom domain + TLS per tenant |
| Audit logs | ❌ | Immutable audit trail per tenant |
| VPC / private networking | ❌ | AWS/Azure/GCP private deployment |
| Contract-based billing (not self-serve) | ❌ | Manual provisioning + invoice |
| SOC 2 / GDPR controls | ❌ | RLS, encryption, DPA, data export |
| Time to onboard | **Not possible** | **2–4 weeks with runbook** |

**Isolation model:** Database-per-tenant or dedicated cluster. Separate deployment stack from shared SaaS.

### 2.4 Onboarding Comparison Matrix

| Dimension | Startup | SME | Enterprise |
|-----------|---------|-----|------------|
| Tenancy | Shared pool | Shared pool (strict) | Dedicated |
| Auth | Email/password | SSO optional | SSO required |
| Billing | Self-serve Stripe | Stripe + invoicing | Contract / invoice |
| Voice config | Self-serve Dial connect | Admin-assisted | White-glove setup |
| Deployment | Shared Vercel | Shared Vercel | Dedicated K8s / cloud account |
| Support | Docs + chat | Priority support | Named CSM + SLA |

---

## 3. Target SaaS Architecture

### 3.1 High-Level Target

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CONTROL PLANE (new)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Provisioning│  │ Billing      │  │ Tenant Admin│  │ Feature Flags│ │
│  │ API         │  │ (Stripe)     │  │ Portal      │  │ Service      │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    tenant context (JWT claim + middleware)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         DATA PLANE (existing, extended)                   │
│                                                                          │
│  webapp-dashboard ──► svc-api ──► PostgreSQL (tenant-scoped)           │
│                           │                                              │
│                           ├── svc-engagement (per-tenant provider cfg)  │
│                           └── svc-qualifier                             │
│                                                                          │
│  Optional: svc-tenant (new) — tenant resolution, config, limits         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT PLANE (new)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ CI/CD      │  │ Terraform  │  │ K8s / ECS  │  │ Observability    │  │
│  │ (GHA)      │  │ modules    │  │ (optional) │  │ (OTel + logs)    │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 New Domain Models (Prisma)

These are the minimum new entities. All existing domain tables gain a `tenantId` foreign key.

```
Tenant
├── id, slug, name, status (ACTIVE|SUSPENDED|PROVISIONING)
├── planId → Plan
├── region (us-east, eu-west, ...)
├── settings (JSON: branding, timezone, locale)
├── integrations (JSON: encrypted Dial/Twilio credentials)
└── createdAt, updatedAt

TenantMembership
├── tenantId, userId, role (OWNER|ADMIN|MANAGER|AGENT)
└── unique(tenantId, userId)

Plan
├── id, name (STARTER|PROFESSIONAL|ENTERPRISE)
├── limits (JSON: maxAgents, maxLeads, maxCallsPerMonth)
└── features (JSON: sso, customDomain, apiAccess)

Subscription
├── tenantId, stripeCustomerId, stripeSubscriptionId
├── status, currentPeriodEnd
└── planId

AuditLog (enterprise)
├── tenantId, actorId, action, resource, metadata, timestamp
```

**User model change:** Remove global `@unique` on `email`. Replace with `@@unique([tenantId, email])` or keep email globally unique and use `TenantMembership` for multi-tenant users (agents working at multiple brokerages).

### 3.3 Request Flow (Target)

```
1. User visits acme.estatecraft.io
2. Dashboard resolves tenant from subdomain → stores tenantSlug
3. Login → POST /api/auth/login { email, password, tenantSlug }
4. Auth validates User + TenantMembership → JWT includes tenantId
5. All API requests carry Bearer token
6. authMiddleware extracts tenantId from JWT
7. tenantMiddleware validates tenant is ACTIVE, sets AsyncLocalStorage context
8. Prisma extension auto-injects WHERE tenantId = ? on all queries
9. Voice orchestrator loads per-tenant Dial credentials from Tenant.integrations
```

---

## 4. Multi-Tenancy Strategy

### 4.1 Recommended Approach: Shared Database, Shared Schema

| Approach | Pros | Cons | Fit |
|----------|------|------|-----|
| **Shared DB, shared schema + `tenantId`** | Lowest cost, fastest to build, easy migrations | Requires discipline; one bug can leak data | **Startup + SME (default)** |
| Shared DB, schema-per-tenant | Stronger isolation, easier export | Migration complexity scales with tenants | SME with compliance needs |
| Database-per-tenant | Maximum isolation | Expensive, slow provisioning | **Enterprise** |
| Deployment-per-tenant | Full isolation + custom SLAs | Highest ops cost | **Enterprise flagship** |

**Recommendation:** Build **shared schema + `tenantId`** first with Prisma middleware and Postgres RLS as a safety net. Add database-per-tenant as an enterprise provisioning option in Phase 4.

### 4.2 Isolation Layers (Defense in Depth)

1. **Application layer** — Prisma client extension injects `tenantId` on every query
2. **API layer** — Middleware rejects cross-tenant resource access (IDOR prevention)
3. **Database layer** — Postgres Row-Level Security policies on tenant-scoped tables
4. **Integration layer** — Per-tenant encrypted credentials in `Tenant.integrations`
5. **Observability layer** — All logs/traces tagged with `tenantId`

### 4.3 Tenant Resolution Options

| Method | Use Case | Implementation |
|--------|----------|----------------|
| Subdomain (`{slug}.estatecraft.io`) | Default SaaS | DNS wildcard + middleware |
| Custom domain | Enterprise | CNAME + tenant lookup by domain |
| JWT claim | API access | `tenantId` in token payload |
| Header (`X-Tenant-ID`) | Internal/admin only | Service-to-service, never expose to browsers |

---

## 5. Cloud Portability Strategy

### 5.1 Current Cloud Posture

EstateCraft is **deployment-portable but operationally Vercel-locked**:

- **Portable:** Node.js, Express, Prisma, PostgreSQL, env-var configuration
- **Vercel-specific:** `api/index.ts` serverless wrapper, `SKIP_INFRA=true`, 30s function timeout, no long-running workers
- **Not portable:** No Dockerfile for app services, no health-check standards, no Helm charts

### 5.2 Target: Cloud-Agnostic Deployment Layers

```
Layer 1 — Application (cloud-agnostic)
  Node services, 12-factor env config, stateless API

Layer 2 — Container (portable)
  Dockerfile per service, multi-stage builds

Layer 3 — Orchestration (swappable)
  Option A: Vercel (startup tier, serverless)
  Option B: AWS ECS Fargate / Azure Container Apps / GCP Cloud Run
  Option C: Kubernetes (enterprise, full control)

Layer 4 — Infrastructure (IaC)
  Terraform modules per cloud with shared interface
```

### 5.3 Terraform Module Structure (to create)

```
infra/
├── modules/
│   ├── database/          # Postgres (RDS, Cloud SQL, Neon)
│   ├── cache/             # Redis
│   ├── queue/             # RabbitMQ or SQS
│   ├── api/               # Container service
│   └── frontend/          # Static hosting or CDN
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
└── tenants/               # Enterprise dedicated stacks
    └── {tenant-slug}/
```

### 5.4 Environment Configuration Standard

Replace ad-hoc env vars with a structured config schema:

```typescript
// lib-shared/src/config/schema.ts (proposed)
{
  app: { nodeEnv, port, logLevel },
  database: { url },
  auth: { jwtSecret, jwtExpiresIn, oidcProvider? },
  tenancy: { mode: 'shared' | 'dedicated', defaultRegion },
  voice: { defaultProvider },  // overridden per-tenant at runtime
  infra: { redisUrl?, rabbitmqUrl?, skipInfra },
  billing: { stripeSecretKey?, stripeWebhookSecret? },
  observability: { otelEndpoint?, sentryDsn? }
}
```

---

## 6. Gap Analysis & Required Artifacts

### 6.1 Artifacts to Create

| # | Artifact | Package / Path | Priority |
|---|----------|----------------|----------|
| A1 | Tenant Prisma models + migration | `infra-migrations/prisma/` | P0 |
| A2 | Prisma tenant-scoping extension | `svc-api/src/prisma/` | P0 |
| A3 | Tenant context middleware | `svc-api/src/middleware/tenant.ts` | P0 |
| A4 | Unified DB-backed auth | `svc-api/src/routes/auth.ts` | P0 |
| A5 | RBAC middleware (`requireRole`) | `svc-api/src/middleware/rbac.ts` | P0 |
| A6 | Tenant provisioning API | `svc-api/src/routes/tenants.ts` | P0 |
| A7 | Per-tenant integration config service | `svc-engagement/src/tenant-config.ts` | P1 |
| A8 | Stripe billing integration | `svc-billing/` (new package) | P1 |
| A9 | Tenant admin UI (settings, billing) | `webapp-dashboard/src/pages/settings/` | P1 |
| A10 | Subdomain routing in dashboard | `webapp-dashboard/src/lib/tenant.ts` | P1 |
| A11 | Versioned Prisma migrations | `infra-migrations/prisma/migrations/` | P0 |
| A12 | Dockerfile (api, dashboard) | `Dockerfile`, `docker-compose.prod.yml` | P1 |
| A13 | GitHub Actions CI/CD | `.github/workflows/` | P1 |
| A14 | Terraform base modules | `infra/terraform/` | P2 |
| A15 | Postgres RLS policies | `infra-migrations/sql/rls/` | P1 |
| A16 | Audit log service | `svc-api/src/services/audit.ts` | P2 |
| A17 | Tenant-aware rate limiting | `svc-api/src/middleware/rate-limit.ts` | P1 |
| A18 | OpenTelemetry instrumentation | All services | P2 |
| A19 | Enterprise provisioning runbook | `docs/runbooks/ENTERPRISE_ONBOARDING.md` | P2 |
| A20 | SSO integration (OIDC) | `svc-auth/` or external IdP | P2 |

### 6.2 Files to Modify (Existing)

| File | Change |
|------|--------|
| `infra-migrations/prisma/schema.prisma` | Add `Tenant`, `TenantMembership`, `Plan`, `Subscription`; add `tenantId` to all domain models |
| `svc-api/src/middleware/auth.ts` | Include `tenantId` in `req.user` |
| `svc-api/src/routes/*.ts` | Remove global queries; rely on tenant-scoped Prisma |
| `svc-api/src/app.ts` | Register tenant middleware, RBAC, per-tenant rate limits |
| `svc-engagement/src/config.ts` | Load per-tenant voice credentials at call time |
| `webapp-dashboard/` | Tenant context provider, login with slug, settings pages |
| `.env.example` | Add Stripe, tenancy mode, OTel vars |
| `docker-compose.yml` | Add app service containers for local prod-like testing |
| `vercel.json` | Review serverless limits; document when to move to containers |

---

## 7. Phased Implementation Roadmap

### Phase 0 — Foundation (Week 1–2)

**Goal:** Stop the bleeding — unify auth, add migrations, prepare schema.

| Step | Work Item | Acceptance Criteria |
|------|-----------|---------------------|
| 0.1 | Switch from `db push` to `prisma migrate` | Versioned migrations in repo; `migrate deploy` works in CI |
| 0.2 | Unify auth — single DB-backed login in `svc-api` | Demo users authenticate against Prisma `User` table |
| 0.3 | Remove duplicate mock users from `svc-auth` or deprecate separate auth service | One auth path documented |
| 0.4 | Add `requireRole` middleware and enforce on admin routes | Agents cannot access voice rule CRUD |
| 0.5 | Add agent-scoped lead queries | Agents see only `assignedTo = self`; managers see all |

**Branch:** `feat/saas-phase-0-foundation`

### Phase 1 — Multi-Tenancy Core (Week 3–5)

**Goal:** Data isolation for multiple brokerages on one deployment.

| Step | Work Item | Acceptance Criteria |
|------|-----------|---------------------|
| 1.1 | Add `Tenant`, `TenantMembership` models + `tenantId` on all tables | Migration applies cleanly; seed creates 2 demo tenants |
| 1.2 | Implement tenant context middleware | JWT contains `tenantId`; middleware sets request context |
| 1.3 | Prisma client extension for auto-scoping | `findMany()` without tenant filter still only returns own tenant data |
| 1.4 | Migrate seed data to Summit Ridge tenant | Existing demo still works under `summit-ridge` slug |
| 1.5 | Tenant provisioning API (`POST /api/tenants`) | Admin can create tenant + owner user programmatically |
| 1.6 | Postgres RLS policies | Direct SQL access cannot cross tenants |
| 1.7 | Update all API routes and tests | Integration tests prove isolation |

**Branch:** `feat/saas-phase-1-multi-tenancy`

### Phase 2 — Tenant Configuration & Dashboard (Week 6–7)

**Goal:** Each tenant manages their own voice rules and integrations.

| Step | Work Item | Acceptance Criteria |
|------|-----------|---------------------|
| 2.1 | `Tenant.integrations` encrypted JSON field | Store Dial API key per tenant |
| 2.2 | Refactor `VoiceRule` to be tenant-scoped | Summit Ridge rules don't appear for second tenant |
| 2.3 | Per-tenant voice provider factory | Calls use tenant's Dial credentials |
| 2.4 | Dashboard tenant context (subdomain or slug selector) | Login scoped to tenant |
| 2.5 | Tenant settings UI (name, branding, integrations) | Admin can update Dial key in UI |
| 2.6 | Webhook authentication + tenant routing | Dial webhooks mapped to correct tenant |

**Branch:** `feat/saas-phase-2-tenant-config`

### Phase 3 — Billing & Self-Serve Onboarding (Week 8–10)

**Goal:** Startup clients can sign up and pay without manual intervention.

| Step | Work Item | Acceptance Criteria |
|------|-----------|---------------------|
| 3.1 | `Plan` and `Subscription` models | Starter / Professional / Enterprise plans seeded |
| 3.2 | Stripe integration (Checkout + webhooks) | Payment creates tenant + subscription |
| 3.3 | Plan-based feature flags and limits | Starter plan caps agents at 10 |
| 3.4 | Self-serve signup flow in dashboard | New user → pay → tenant provisioned → redirected to dashboard |
| 3.5 | Per-tenant rate limiting | API quotas enforced per plan |
| 3.6 | Usage metering (calls, SMS) | Counters per tenant per billing period |
| 3.7 | Billing portal (Stripe Customer Portal) | Tenant admin can manage payment method |

**Branch:** `feat/saas-phase-3-billing`

### Phase 4 — Production Operations & Enterprise (Week 11–14)

**Goal:** Deploy anywhere; onboard enterprise clients with dedicated infra.

| Step | Work Item | Acceptance Criteria |
|------|-----------|---------------------|
| 4.1 | Dockerfiles + `docker-compose.prod.yml` | Full stack runs in containers locally |
| 4.2 | GitHub Actions: test → build → deploy staging | PR checks pass; staging auto-deploys |
| 4.3 | Terraform modules (AWS first) | `terraform apply` provisions Postgres + ECS + ALB |
| 4.4 | OIDC/SSO integration | Enterprise tenant can use Azure AD |
| 4.5 | Custom domain support | `crm.client.com` routes to tenant |
| 4.6 | Audit log service | All mutations logged with actor + tenant |
| 4.7 | Enterprise provisioning runbook | Ops can onboard dedicated-DB tenant in < 4 hours |
| 4.8 | OpenTelemetry + tenant-tagged logging | Dashboards filterable by tenant |
| 4.9 | Data export / GDPR delete | Tenant offboarding removes all data |

**Branch:** `feat/saas-phase-4-enterprise-ops`

---

## 8. Decision Log

Record these decisions before implementation begins. Update as choices are made.

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| D1 | Multi-tenancy model | Shared schema / schema-per-tenant / DB-per-tenant | Shared schema + `tenantId` (default); DB-per-tenant for enterprise | **Proposed** |
| D2 | Auth provider | Custom JWT / Auth0 / Clerk / Supabase Auth | Custom JWT Phase 0–2; Clerk or Auth0 for SSO in Phase 4 | **Proposed** |
| D3 | Billing provider | Stripe / Paddle / Chargebee | Stripe (industry standard, best docs) | **Proposed** |
| D4 | Primary deployment target | Vercel / AWS ECS / K8s | Vercel for startup/SME; AWS ECS for enterprise | **Proposed** |
| D5 | IaC tool | Terraform / Pulumi / CDK | Terraform (widest hiring pool, most examples) | **Proposed** |
| D6 | Tenant resolution | Subdomain / path / header | Subdomain primary; custom domain for enterprise | **Proposed** |
| D7 | Secrets per tenant | Encrypted JSON in DB / Vault / cloud KMS | Encrypted JSON in Phase 2; migrate to KMS in Phase 4 | **Proposed** |
| D8 | Keep `svc-auth` separate? | Merge into `svc-api` / keep separate | Merge into `svc-api` (simpler for Vercel serverless) | **Proposed** |
| D9 | Email uniqueness | Global / per-tenant | Per-tenant (`@@unique([tenantId, email])`) | **Proposed** |
| D10 | Message bus | RabbitMQ / SQS / Redis Streams | Defer to Phase 4; use direct calls until scale demands async | **Proposed** |

---

## 9. Interactive Implementation Guide

Use this section to drive implementation in chat. Say which phase/step you want to start, and we will implement it on a feature branch.

### Quick Start Commands (after each phase)

```bash
# Create feature branch
git checkout -b feat/saas-phase-N-description

# Run migrations
pnpm run db:migrate

# Run tests
pnpm test

# Push for review
git push -u origin feat/saas-phase-N-description
```

### Suggested First Session

Start with **Phase 0, Step 0.1 + 0.2** — these are low-risk, high-value, and don't require product decisions:

1. Convert to `prisma migrate`
2. Wire auth to Prisma `User` table
3. Add basic `requireRole` middleware

This gives you a production-grade auth foundation before touching the schema for multi-tenancy.

### Questions to Answer Before Phase 1

Before adding `tenantId` to every table, confirm:

1. **Brand domain** — Will SaaS live at `*.estatecraft.io` or a different domain?
2. **Plan tiers** — What are Starter / Pro / Enterprise limits (agents, calls/month, price)?
3. **Auth for Phase 1** — Is custom JWT acceptable for first tenants, or is SSO a day-one requirement for SME?
4. **Dial credentials** — Does each tenant bring their own Dial account, or do you resell Dial capacity?
5. **Data residency** — Is EU hosting required at launch, or US-only is fine for v1?

### Progress Tracker

Copy this into PR descriptions or project board:

```
Phase 0 — Foundation
  [x] 0.1 Prisma migrate
  [x] 0.2 DB-backed auth
  [x] 0.3 Deprecate svc-auth duplication
  [x] 0.4 RBAC middleware
  [x] 0.5 Agent-scoped queries

Phase 1 — Multi-Tenancy Core
  [ ] 1.1 Tenant models + tenantId
  [ ] 1.2 Tenant middleware
  [ ] 1.3 Prisma extension
  [ ] 1.4 Seed migration
  [ ] 1.5 Provisioning API
  [ ] 1.6 Postgres RLS
  [ ] 1.7 Route + test updates

Phase 2 — Tenant Config
  [ ] 2.1 Encrypted integrations
  [ ] 2.2 Tenant-scoped voice rules
  [ ] 2.3 Per-tenant voice factory
  [ ] 2.4 Dashboard tenant context
  [ ] 2.5 Settings UI
  [ ] 2.6 Webhook auth

Phase 3 — Billing
  [ ] 3.1 Plan models
  [ ] 3.2 Stripe integration
  [ ] 3.3 Feature flags
  [ ] 3.4 Self-serve signup
  [ ] 3.5 Rate limiting
  [ ] 3.6 Usage metering
  [ ] 3.7 Billing portal

Phase 4 — Enterprise Ops
  [ ] 4.1 Docker production stack
  [ ] 4.2 CI/CD
  [ ] 4.3 Terraform (AWS)
  [ ] 4.4 SSO
  [ ] 4.5 Custom domains
  [ ] 4.6 Audit logs
  [ ] 4.7 Enterprise runbook
  [ ] 4.8 Observability
  [ ] 4.9 GDPR offboarding
```

---

## Appendix A — Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data leak between tenants | Critical | Medium (without RLS) | Prisma extension + RLS + integration tests |
| Vercel 30s timeout on voice orchestration | High | High | Move long-running work to background queue in Phase 4 |
| Migration downtime on live DB | High | Medium | Versioned migrations + blue/green deploy |
| Per-tenant Dial key exposure | Critical | Low | Encrypt at rest; never log credentials |
| Scope creep in Phase 1 | Medium | High | Strict acceptance criteria per step; merge phases incrementally |

## Appendix B — Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Current system design
- [FUTURE_ENHANCEMENTS.md](./FUTURE_ENHANCEMENTS.md) — Product roadmap (multi-tenant listed)
- [API.md](./API.md) — Current REST API (will need tenant headers/docs update)
- [.env.example](../.env.example) — Environment variables (will expand)

---

*This document is the source of truth for SaaS transformation work. Update it as decisions are made and phases complete.*
