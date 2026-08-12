# EstateCraft API Reference

Base URL: `http://localhost:3000` (dev) or `https://your-app.vercel.app` (production)

Authentication: `Authorization: Bearer <jwt_token>` (except health and webhooks)

## Health

### `GET /health`

Returns platform health including database connectivity.

```json
{
  "status": "healthy",
  "checks": {
    "api": true,
    "database": true,
    "service": "estatecraft-api",
    "version": "1.0.0",
    "voiceProvider": "mock"
  }
}
```

## Auth (svc-api — `/api/auth`)

Multi-tenant JWT auth. Login requires a workspace `tenantSlug` (or `{slug}.estatecraft.io` / `X-Tenant-Slug`).

Roles: `ADMIN`, `MANAGER`, `AGENT` (scoped to membership within the tenant).

- `ADMIN` / `MANAGER`: full lead visibility in tenant; can mutate voice rules; can batch-qualify
- `AGENT`: only leads assigned to them; read-only voice rules
- **Pro / Enterprise**: SSO required (`GET /api/auth/sso/start`)

### `POST /api/auth/login`

```json
{
  "tenantSlug": "summit-ridge",
  "email": "admin@summitridge.demo",
  "password": "password"
}
```

### `GET /api/auth/sso/start?tenantSlug=coastal-homes`

Starts OIDC for SSO-required tenants (Pro/Enterprise).

### `GET /api/auth/me`

Requires Bearer token.

## Tenants

Domain model: `{slug}.estatecraft.io`. Regions: `US` | `EU` | `UAE`. Dial is bring-your-own per tenant.

### `GET /api/tenants/plans`

Public plan catalog (Starter / Pro / Enterprise).

### `GET /api/tenants/by-slug/:slug`

Public tenant branding / SSO flags for login UI.

### `POST /api/tenants`

Provision tenant + owner. Header: `X-Platform-Admin-Key`.

### `GET /api/tenants/current`

Authenticated current workspace profile.

### `PUT /api/tenants/current/integrations/dial`

Admin: store BYO Dial credentials for this tenant.

## Leads

### `GET /api/leads`

Query: `status`, `priority`, `limit`, `offset`

Agents only receive leads where `assignedTo` matches their user id.

### `GET /api/leads/:id`

Returns lead with communications, score history, follow-ups. Agents cannot access unassigned or other agents' leads (403).

### `POST /api/leads`

Create a new lead. Agents are auto-assigned as the owner.

### `POST /api/leads/:id/qualify`

Run qualification scoring. Triggers voice call if score meets voice rule.

### `POST /api/leads/qualify-batch`

Qualify up to 50 `NEW` leads.

## Communications

### `GET /api/communications`

Query: `leadId`, `channel`, `status`, `limit`

### `GET /api/communications/timeline/:leadId`

Communication timeline for a lead.

### `POST /api/communications/call`

```json
{ "leadId": "clx..." }
```

Initiate outbound voice call using highest-priority active voice rule.

### `GET /api/communications/call/:communicationId/status`

Poll call status from provider and update database.

## Voice Rules

### `GET /api/voice-rules`

List all voice rules (any authenticated role).

### `POST /api/voice-rules`

Requires `ADMIN` or `MANAGER`.

```json
{
  "name": "High-Score Outreach",
  "minQualificationScore": 75,
  "maxRetries": 3,
  "retryDelayMinutes": 30,
  "smsFallbackEnabled": true,
  "smsFallbackTemplate": "Hi {{leadName}}, ...",
  "outboundInstruction": "You are a friendly assistant for Summit Ridge Realty...",
  "priority": 10
}
```

### `PUT /api/voice-rules/:id`

Requires `ADMIN` or `MANAGER`. Update rule fields.

### `DELETE /api/voice-rules/:id`

Requires `ADMIN` or `MANAGER`.

## Dashboard

### `GET /api/dashboard/stats`

Voice activity stats: total calls, success rate, SMS fallbacks, recent calls. Scoped to assigned leads for `AGENT`.

### `GET /api/dashboard/leads-summary`

Lead counts and average qualification score. Scoped to assigned leads for `AGENT`.

## Properties

### `GET /api/properties`

### `GET /api/properties/:id`

## Webhooks

### `POST /api/webhooks/dial`

Dial call status webhook (no auth).
