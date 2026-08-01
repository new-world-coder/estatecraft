# Dial Integration Guide

## Overview

EstateCraft integrates [Dial](https://getdial.ai) as the first production `VoiceProvider`. Dial provides outbound AI voice calls and SMS on a single phone number.

## Configuration

```env
VOICE_PROVIDER=dial
DIAL_API_KEY=sk_live_your_key_here
DIAL_FROM_NUMBER_ID=your_number_id
DIAL_BASE_URL=https://api.getdial.ai
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VOICE_PROVIDER` | Yes | Set to `dial` |
| `DIAL_API_KEY` | Yes | API key from Dial dashboard |
| `DIAL_FROM_NUMBER_ID` | Recommended | ID of provisioned Dial number |
| `DIAL_BASE_URL` | No | Defaults to `https://api.getdial.ai` |

## Provisioning a Number

1. Sign up at [getdial.ai](https://getdial.ai)
2. Provision a US number via Dial dashboard or API
3. Copy the number ID to `DIAL_FROM_NUMBER_ID`

If `DIAL_FROM_NUMBER_ID` is not set, the provider calls `listNumbers()` and uses the first available number.

## Outbound Calls

Calls are triggered by:

1. **Lead scoring** — when qualification score meets an active voice rule threshold
2. **Manual API** — `POST /api/communications/call` with `{ "leadId": "..." }`
3. **Dashboard** — "Call" button on Leads tab

The Dial REST payload uses **camelCase** fields (`fromNumberId`, `outboundInstruction`).

The orchestrator passes `outboundInstruction` from the matched voice rule. Use `{{leadName}}` in templates for personalization.

## SMS Fallback

When a voice call fails or receives no answer after max retries, the orchestrator sends SMS via the same Dial provider if `smsFallbackEnabled` is true on the voice rule.

SMS records are linked to the parent call via `parentId` in the communications table.

## Webhooks

Register Dial webhooks to:

```
https://your-domain.vercel.app/api/webhooks/dial
```

The handler updates call status and transcripts in PostgreSQL when Dial sends completion events.

## Retry Logic

Configured per voice rule:

- `maxRetries` — number of retry attempts (default: 3)
- `retryDelayMinutes` — delay before retry (default: 30)

Retries create `scheduled_follow_ups` with type `voice_retry`.

## Switching Providers

To use mock provider (no external API):

```env
VOICE_PROVIDER=mock
```

To prepare Twilio (stub only):

```env
VOICE_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

## Code Location

| File | Purpose |
|------|---------|
| `lib-shared/src/types/communication.ts` | `IVoiceProvider` interface |
| `svc-engagement/src/providers/dial-voice-provider.ts` | Dial REST client |
| `svc-engagement/src/providers/provider-factory.ts` | Provider selection |
| `svc-engagement/src/orchestrator/communication-orchestrator.ts` | Retry + SMS fallback |

No Dial-specific code exists outside `svc-engagement/src/providers/`.
