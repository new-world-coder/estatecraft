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

## Auth (svc-auth — port 3001)

### `POST /api/auth/login`

```json
{ "email": "admin@summitridge.demo", "password": "password" }
```

### `GET /api/auth/me`

Requires Bearer token.

## Leads

### `GET /api/leads`

Query: `status`, `priority`, `limit`, `offset`

### `GET /api/leads/:id`

Returns lead with communications, score history, follow-ups.

### `POST /api/leads`

Create a new lead.

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

List all voice rules.

### `POST /api/voice-rules`

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

Update rule fields.

### `DELETE /api/voice-rules/:id`

## Dashboard

### `GET /api/dashboard/stats`

Voice activity stats: total calls, success rate, SMS fallbacks, recent calls.

### `GET /api/dashboard/leads-summary`

Lead counts and average qualification score.

## Properties

### `GET /api/properties`

### `GET /api/properties/:id`

## Webhooks

### `POST /api/webhooks/dial`

Dial call status webhook (no auth).
