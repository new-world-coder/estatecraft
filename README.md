# EstateCraft

**AI-powered communication orchestration for real estate sales.**

EstateCraft evolves traditional CRM outreach into an enterprise-ready platform with provider-based voice and SMS automation. Dial is the first production voice provider; Twilio and others can be added without scattering vendor code.

## Features

- Lead scoring with automatic voice call triggers
- Provider-based architecture (`IVoiceProvider`)
- Dial integration for outbound AI voice + SMS fallback
- Call status tracking, retry logic, communication timeline
- Voice activity dashboard and voice rules configuration UI
- 100 leads, 20 agents, properties — Summit Ridge Realty sample data

## Quick Start (Local)

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- npm >= 9

### Setup

```bash
git clone <repo-url>
cd estatecraft
cp .env.example .env
npm install
npm run docker:up
npm run db:migrate
npm run db:seed
```

### Run

```bash
# API + Dashboard
npm run dev

# Auth service (required for login)
npm run dev:auth
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3000 |
| Auth | http://localhost:3001 |

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@summitridge.demo | password |
| Manager | manager@summitridge.demo | password |
| Agent | agent1@summitridge.demo | password |

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | local Postgres | PostgreSQL connection |
| `JWT_SECRET` | dev secret | Must match across api + auth |
| `VOICE_PROVIDER` | `mock` | `mock`, `dial`, or `twilio` |
| `DIAL_API_KEY` | — | Required when `VOICE_PROVIDER=dial` |
| `SKIP_INFRA` | `false` | Skip RabbitMQ/Redis (use on Vercel) |

**Never commit secrets.** Use `.env` locally and Vercel environment variables in production.

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set production env vars in Vercel dashboard:
# DATABASE_URL, JWT_SECRET, VOICE_PROVIDER, CORS_ORIGINS, SKIP_INFRA=true
```

Build command (configured in `vercel.json`): `npm run build:vercel`

Provision a PostgreSQL database (Neon, Supabase, or Vercel Postgres) and set `DATABASE_URL`. Run migrations:

```bash
cd infra-migrations && npx prisma db push
npm run seed
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture diagrams |
| [docs/DIAL_INTEGRATION.md](docs/DIAL_INTEGRATION.md) | Dial setup guide |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | 5-minute prospect walkthrough |
| [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) | Dummy data + mock + Dial live call testing |
| [docs/FUTURE_ENHANCEMENTS.md](docs/FUTURE_ENHANCEMENTS.md) | Roadmap |

## Project Structure

```
estatecraft/
├── api/                    # Vercel serverless entry
├── webapp-dashboard/       # React dashboard
├── svc-api/                # API gateway
├── svc-auth/               # Authentication
├── svc-engagement/         # Communication orchestrator + Dial provider
├── svc-qualifier/          # Lead scoring engine
├── lib-shared/             # Shared types and events
├── infra-migrations/       # Prisma schema + seed
└── docs/
```

## License

MIT
