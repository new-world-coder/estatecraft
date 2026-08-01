# EstateCraft Demo Script (5 Minutes)

**Company**: Summit Ridge Realty (fictional Colorado brokerage)

**Credentials**: `admin@summitridge.demo` / `password`

---

## 1. Platform Health (30 seconds)

1. Open the dashboard at `http://localhost:5173`
2. Sign in with demo credentials
3. Go to **Overview** tab
4. Point out the health JSON — API online, database connected, voice provider mode

> "EstateCraft is our communication orchestration layer. Every channel runs through a single provider abstraction — today powered by Dial for voice and SMS."

---

## 2. Lead Pipeline (1 minute)

1. Open **Leads** tab — 100 seeded leads across Colorado markets
2. Highlight qualification scores (color-coded)
3. Click **Score** on a `NEW` lead
4. Explain: scoring runs budget, timeline, motivation, authority, and need factors

> "When a lead crosses the voice rule threshold, the system automatically triggers an outbound AI call — no manual dialer work."

---

## 3. Voice Activity (1 minute)

1. Open **Voice Activity** tab
2. Show completed vs failed calls and success rate
3. Click **Call** on a high-score lead from Leads tab
4. Return to Voice Activity — new call appears in recent activity

> "Calls go through Dial with configurable AI instructions. Failed calls retry automatically, then SMS fallback kicks in."

---

## 4. Communication Timeline (1 minute)

1. Open **Timeline** tab
2. Select a lead with history
3. Walk through voice calls, SMS fallbacks, and transcripts

> "Every touchpoint is in one timeline — voice, SMS, retries linked to parent calls. Agents see the full story before they pick up the phone."

---

## 5. Voice Rules Configuration (1 minute)

1. Open **Voice Rules** tab
2. Show "High-Score Lead Outreach" rule — min score 75, 3 retries, SMS fallback
3. Create a quick test rule or edit outbound instruction
4. Mention `{{leadName}}` personalization

> "Rules are fully configurable without code changes. Swap instructions, thresholds, and fallback templates from the admin UI."

---

## 6. Properties & Close (30 seconds)

1. Open **Properties** tab — Summit Ridge listings in Denver, Boulder, Aspen
2. Recap: provider-based architecture, Dial integration, extensible to Twilio

> "EstateCraft turns lead scoring into automated outreach. Summit Ridge agents focus on closing — the platform handles the cadence."

---

**Total time**: ~5 minutes
