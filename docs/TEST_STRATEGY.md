# EstateCraft Test Strategy

End-to-end guide to load **Summit Ridge Realty** dummy data and validate voice calls — first with the **mock** provider (free, local), then with **Dial** (uses your free credit).

**Related docs:** [DIAL_INTEGRATION.md](./DIAL_INTEGRATION.md) · [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) · [API.md](./API.md)

---

## Why you see no data after login

Login works without a database, but **leads, properties, voice stats, and timelines all come from PostgreSQL**. If you see empty tabs, one of these is true:

| Cause | Fix |
|-------|-----|
| `DATABASE_URL` not set | Add Postgres connection string to `.env` (local) or Vercel env vars |
| Schema not applied | Run `npm run db:migrate` |
| Seed never run | Run `npm run db:seed` |
| API can't reach DB | Check **Overview → Platform Health** — `database` should be `true` |

---

## Phase 0 — Prerequisites

### Local (recommended for first test)

```bash
cp .env.example .env
pnpm install
npm run docker:up          # Postgres on localhost:5432
npm run db:migrate
npm run db:seed
```

### Production (Vercel)

1. Create a Postgres DB (Neon, Supabase, or Vercel Postgres).
2. In Vercel → Project → Settings → Environment Variables, set:
   - `DATABASE_URL`
   - `JWT_SECRET` (same value you use locally if testing both)
   - `SKIP_INFRA=true`
   - `CORS_ORIGINS=https://estatecraft-kohl.vercel.app`
3. From your machine (with `DATABASE_URL` pointing at production):

```bash
cd infra-migrations
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." npm run seed
```

After seeding you should have:

- **100 leads**, **20 agents**, **25 properties**
- **2 voice rules**, communication history, score history, follow-ups
- Demo login still uses mock auth users (`admin@summitridge.demo` / `password`) — separate from DB users

---

## Phase 1 — Smoke test (no Dial, ~10 min)

**Goal:** Confirm data loads and mock voice flow works before spending Dial credit.

### 1.1 Start stack

```bash
# Terminal 1 — API (auth is on port 3000)
cd svc-api && SKIP_INFRA=true npm run dev

# Terminal 2 — Dashboard
cd webapp-dashboard && npm run dev
```

Open **http://localhost:5173** (incognito if you had cache issues). Login: `admin@summitridge.demo` / `password`.

### 1.2 Verify data

| Tab | Expected |
|-----|----------|
| Overview | Health JSON shows `"database": true` |
| Leads | ~100 rows with scores and cities |
| Properties | ~25 Summit Ridge listings |
| Voice Rules | 2 rules (High-Score Lead Outreach, Warm Lead Follow-up) |
| Voice Activity | Stats from seeded mock call history |

### 1.3 Mock outbound call

1. **Leads** → pick any lead with a phone number.
2. Click **Call**.
3. **Voice Activity** → new row appears (provider: `mock`).
4. **Timeline** → select same lead → voice entry with content/instruction.

### 1.4 Mock qualification trigger

1. **Leads** → find a lead with status `NEW`.
2. Click **Score**.
3. If score ≥ rule threshold (60–75), orchestrator may auto-trigger a mock call (check Voice Activity).

### 1.5 API spot-check (optional)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@summitridge.demo","password":"password"}' \
  | jq -r '.data.token')

# Leads
curl -s http://localhost:3000/api/leads?limit=5 -H "Authorization: Bearer $TOKEN" | jq '.count'

# Health
curl -s http://localhost:3000/health | jq '.checks'
```

**Pass criteria:** Non-zero leads, mock call creates a communication record, health shows database connected.

---

## Phase 2 — Dial live call test (~15 min)

**Goal:** Place one real outbound call using Dial’s free credit (~$5 on signup).

### 2.1 Dial account setup

1. Sign up at [getdial.ai](https://getdial.ai).
2. Create an API key (Dashboard → API keys).
3. **Provision a phone number** (US). Note the **number ID** (not just the E.164 number).
4. Confirm balance shows free credit.

### 2.2 Configure EstateCraft for Dial

In `.env` (local) or Vercel env vars:

```env
VOICE_PROVIDER=dial
DIAL_API_KEY=sk_live_...          # your key — never commit
DIAL_FROM_NUMBER_ID=...           # from Dial dashboard
DIAL_BASE_URL=https://api.getdial.ai
```

Restart the API after changing env vars.

Verify provider in health:

```bash
curl -s http://localhost:3000/health | jq '.checks.voiceProvider'
# expect: "dial"
```

### 2.3 Create a test lead with **your** phone number

**Important:** Seeded leads use random `+1` numbers. For a real ring, use your mobile.

**Option A — Dashboard:** Leads tab won’t have “create lead” UI yet; use API:

```bash
TOKEN=... # from login above

curl -s -X POST http://localhost:3000/api/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Test",
    "lastName": "Caller",
    "email": "test.caller@example.demo",
    "phone": "+1YOUR_MOBILE_HERE",
    "source": "WEBSITE",
    "priority": "HIGH",
    "city": "Denver",
    "state": "CO"
  }' | jq '.data.id'
```

Save the returned `id` as `LEAD_ID`.

**Option B — Update existing lead** (if you add a PATCH route later, or via Prisma Studio):

```bash
cd infra-migrations && npx prisma studio
# Edit one lead’s phone to your number
```

### 2.4 Place the Dial call

**Option A — Dashboard:** Leads → your test lead → **Call**.

**Option B — API:**

```bash
curl -s -X POST http://localhost:3000/api/communications/call \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"leadId\": \"$LEAD_ID\"}" | jq
```

### 2.5 What to validate

| Check | Where |
|-------|--------|
| Phone rings | Your mobile |
| AI agent speaks using voice rule instruction | Live call |
| Communication record created | Voice Activity / Timeline |
| Provider = `dial` | API response / DB |
| Call status updates | Poll or webhook (below) |
| Credit deducted | Dial dashboard billing |

Poll status (use `communicationId` from call response):

```bash
curl -s "http://localhost:3000/api/communications/call/COMM_ID/status" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 2.6 Webhooks (production / public URL)

For completed status + transcript on Vercel, register in Dial:

```
https://estatecraft-kohl.vercel.app/api/webhooks/dial
```

Local testing without webhooks: use the **Poll status** endpoint above.

### 2.7 SMS fallback (optional, uses more credit)

1. Voice Rules → ensure **SMS fallback** enabled.
2. Use a number that won’t answer, or let mock retries exhaust (Dial path uses real failures).
3. Timeline should show SMS child linked to failed voice call.

---

## Phase 3 — Automated qualification → voice (Dial)

**Goal:** Score a lead and auto-trigger Dial when threshold met.

1. Create lead with **your phone**, status will be `NEW`.
2. Ensure an active voice rule has `minQualificationScore` ≤ expected score (default rules: 60 or 75).
3. **Leads → Score** (or `POST /api/leads/:id/qualify`).
4. If score ≥ threshold and lead has phone → outbound Dial call should start automatically.
5. Confirm in Voice Activity and Dial dashboard.

---

## Phase 4 — Production (Vercel) checklist

- [ ] `DATABASE_URL` set and schema pushed
- [ ] `npm run seed` run against production DB
- [ ] `JWT_SECRET` set
- [ ] `VOICE_PROVIDER=dial` + `DIAL_API_KEY` + `DIAL_FROM_NUMBER_ID`
- [ ] `CORS_ORIGINS` includes production URL
- [ ] Login at https://estatecraft-kohl.vercel.app
- [ ] Overview shows `database: true`
- [ ] Leads tab populated
- [ ] Test call to your phone
- [ ] Dial webhook URL registered (optional)

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Empty Leads/Properties | No seed / no DB | Phase 0 |
| `database: false` in health | Wrong `DATABASE_URL` or Postgres down | `docker compose ps`, fix URL |
| Call button does nothing | No voice rules | Re-run seed or create rule in UI |
| `No Dial phone numbers` | No number provisioned | Provision in Dial dashboard |
| Call fails 401 from Dial | Bad API key | Rotate key in Dial, update env |
| Wrong number called | Random seeded phone | Create test lead with your number |
| Still `mock` provider | Env not loaded | Restart API, check `VOICE_PROVIDER` |
| Login works, API 500 on leads | Prisma / schema mismatch | `npm run db:migrate` |

---

## Quick reference — env for Dial test

```env
DATABASE_URL=postgresql://estatecraft_user:estatecraft_password@localhost:5432/estatecraft
JWT_SECRET=dev-jwt-secret-change-in-production
VOICE_PROVIDER=dial
DIAL_API_KEY=<from Dial dashboard>
DIAL_FROM_NUMBER_ID=<from Dial dashboard>
SKIP_INFRA=true
```

---

## Suggested test order (summary)

1. **Seed data** → confirm UI populated  
2. **Mock call** → confirm orchestration without cost  
3. **Dial config** → health shows `dial`  
4. **Test lead with your phone** → manual **Call**  
5. **Score trigger** → auto call on qualification  
6. **Webhook + timeline** → status/transcript on production  

For a prospect-facing walkthrough after data is loaded, use [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) (~5 minutes).
