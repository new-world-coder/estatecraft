# EstateCraft Architecture

## Overview

EstateCraft is a communication orchestration platform for real estate sales. It uses a provider-based architecture so voice and SMS channels can be swapped (Dial, Twilio, mock) without changing business logic.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph client [Client Layer]
        DASH[webapp-dashboard<br/>React + Vite]
    end

    subgraph gateway [API Gateway]
        API[svc-api<br/>Express REST]
        AUTH[svc-auth<br/>JWT Auth]
    end

    subgraph domain [Domain Services]
        QUAL[svc-qualifier<br/>Lead Scoring]
        ENG[svc-engagement<br/>Communication Orchestrator]
    end

    subgraph providers [Communication Providers]
        DIAL[DialVoiceProvider]
        TWILIO[TwilioVoiceProvider stub]
        MOCK[MockVoiceProvider]
    end

    subgraph shared [Shared Library]
        LIB[lib-shared<br/>Types, Events, Schemas]
    end

    subgraph data [Data Layer]
        PG[(PostgreSQL<br/>Prisma)]
    end

    subgraph external [External APIs]
        DIALAPI[Dial API<br/>Voice + SMS]
    end

    DASH --> API
    DASH --> AUTH
    API --> QUAL
    API --> ENG
    QUAL --> ENG
    ENG --> DIAL
    ENG --> TWILIO
    ENG --> MOCK
    DIAL --> DIALAPI
    API --> PG
    QUAL --> PG
    ENG --> PG
    QUAL --> LIB
    ENG --> LIB
    API --> LIB
```

## Communication Flow

```mermaid
sequenceDiagram
    participant L as Lead
    participant Q as svc-qualifier
    participant O as Orchestrator
    participant P as VoiceProvider Dial
    participant DB as PostgreSQL

    L->>Q: New lead created
    Q->>Q: Score lead factors
    Q->>DB: Update score + history
    alt Score >= voice rule threshold
        Q->>O: Trigger voice call
        O->>DB: Create communication record
        O->>P: initiateCall
        P-->>O: callId + status
        O->>DB: Update call record
    end
    alt Call fails / no answer
        O->>O: Schedule retry
        O->>P: sendSms fallback
        O->>DB: Link SMS to parent call
    end
```

## Provider Abstraction

All voice/SMS operations go through `IVoiceProvider` in `lib-shared`. Dial-specific code lives only in `svc-engagement/src/providers/dial-voice-provider.ts`.

| Provider | Status | Use Case |
|----------|--------|----------|
| `mock` | Implemented | Local dev, demos |
| `dial` | Implemented | Production voice + SMS |
| `twilio` | Stub | Future integration |

Set `VOICE_PROVIDER` environment variable to select provider.

## Key Packages

| Package | Responsibility |
|---------|----------------|
| `lib-shared` | Domain types, Zod schemas, events |
| `svc-api` | REST API, Prisma store, route handlers |
| `svc-engagement` | Provider factory, orchestrator, retry/SMS fallback |
| `svc-qualifier` | Lead scoring, voice trigger on threshold |
| `infra-migrations` | Prisma schema, seed data |
| `webapp-dashboard` | Admin UI |

## Deployment

- **Local**: Docker Compose (Postgres, RabbitMQ, Redis) + `npm run dev`
- **Vercel**: Serverless Express via `api/index.ts`, static dashboard, external Postgres
