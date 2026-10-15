# NeoStrike — iGaming Compliance-as-Code

> Real-time risk scoring, ML-based behavioural archetypes, autonomous agent APIs, and LLM-generated compliance narratives — packaged as a plug-in compliance layer for iGaming operators.

---

## Overview

NeoStrike Product B is a **Compliance-as-Code platform** for online gaming operators. It sits between your existing platform and your compliance team, processing every player event in near-real-time (<200 ms SLA) and producing:

- Risk scores and intervention recommendations
- Behavioural archetype classifications (HDBSCAN-style ML)
- Risk trajectory predictions (XGBoost-style ML)
- LLM-generated narrative explanations via the Anthropic Claude API
- Structured regulatory reports
- An agent-facing API (AFA) for autonomous compliance actions

The platform ships as three deployable units inside this monorepo:

| Unit | Directory | Description |
|---|---|---|
| **Backend API** | `backend/` | Express.js, Node 20; port 5000 |
| **Operator Portal** | `frontend/` | React 18 + Vite; proxies `/api → localhost:5000` |
| **SDK** | `sdk/` | `@neostrike/sdk` — React hooks + JS client |

---

## Architecture

```
Browser / AI Agent
      │
      ▼
  Vite Dev Server  (proxy /api)
      │
      ▼
  Express Backend  (:5000)
      │
      ├── Supabase (PostgreSQL + Row-Level Security)
      ├── Redis    (caching, rate-limit state)
      └── RabbitMQ (async compliance event bus)
```

### Intelligence Pipeline (10 Steps)

Every inbound compliance event flows through a 10-step pipeline:

**Synchronous (<130 ms p99)**
1. NES adapter — validate, dedup, persist
2. F11 rule engine — behavioural pattern matching
3. Trajectory ML — XGBoost-style risk trajectory prediction
4. Archetype ML — HDBSCAN-style behavioural classification (cached)
5. Alert object persisted to DB
6. AFA SSE event published
7. Dashboard display update (immediate)

**Async (operator Anthropic key required)**

8. API key gateway check (Vault lookup + cost gate)
9. Anthropic API call (Claude — 2–8 s)
10. Dashboard AI narrative update via SSE push

### Multi-Tenancy

Row-Level Security (RLS) in Supabase enforces tenant isolation. Every service query carries a `brand_id`. The sandbox middleware (`backend/middleware/sandbox.js`) handles demo-mode JIT user creation.

---

## Key Features

### Behavioural Archetypes (ML)

`backend/services/ml-archetype-service.js` classifies each player into one of five archetypes based on a six-feature behavioural vector:

| Archetype | Signature |
|---|---|
| `RECREATIONAL_CASUAL` | Low frequency, low stakes, high game diversity, <45 min sessions |
| `RECREATIONAL_INTENSE` | High weekend/evening frequency, moderate stakes, self-correcting |
| `PROFESSIONAL` | Very high volume, consistent, low diversity, regular withdrawals |
| `AT_RISK` | Escalating bets, chase-loss patterns, deposits without withdrawals |
| `ACUTE_CRISIS` | Sudden shift from a stable archetype |
| `UNCLASSIFIED` | Insufficient data (<5 sessions) |

### Risk Trajectory Prediction

`backend/services/ml-trajectory-service.js` predicts short-term risk escalation using a gradient-boosted model trained on session sequences.

### Anthropic Gateway

`backend/services/anthropic-gateway.js` wraps the Anthropic Claude API with:
- Per-operator AES-256 encrypted key storage
- Monthly token cost gates
- Rate-limit retry logic (60 s back-off)
- `x-no-data-retention` header on every call
- Zero-log policy: keys are never emitted to logs or API responses

### Agent-Friendly API (AFA)

`/api/v1/ops/` is the machine-facing surface. It enforces **three trust tiers** via JWT scopes:

| Tier | Scope | Behaviour |
|---|---|---|
| T1 | `read` | Metrics, alerts, audit log — read-only |
| T2 | `execute` | Pre-authorised interventions execute immediately |
| T3 | `propose` | Action written to the approval queue; a human operator must approve |

AFA endpoints include:
- `GET /openapi.json` — OpenAPI 3.1 schema (unauthenticated)
- `GET /metrics` — platform KPIs
- `GET /alerts` — enriched compliance alerts with ML context
- `GET /audit` — immutable audit trail
- `POST /actions/:type` — T2/T3 interventions
- `GET /events` — SSE stream for live alert delivery

---

## Route Map

| Prefix | File | Purpose |
|---|---|---|
| `/api/v1/ops/` | `routes/afa.js` | AFA: metrics, alerts, audit, T2/T3 actions, SSE stream |
| `/api/v1/auth/` | `routes/afa-auth.js` | Agent JWT issuance & validation |
| `/api/v1/` | `routes/compliance.js` | Event ingestion, player risk profiles, interventions |
| `/api/v1/adapters/` | `routes/adapters.js` | EveryMatrix / SoftSwiss platform adapters |
| `/api/v1/operator/ai/` | `routes/ai-settings.js` | Per-operator Anthropic key management |
| `/api/v1/regulatory-reports/` | `routes/regulatory-reports.js` | LLM-generated compliance reports |
| `/api/authenticate`, `/api/user/` | `routes/operator.js` | Operator portal auth & profile |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- Redis (local or managed)
- RabbitMQ / CloudAMQP (optional; async narrative enrichment only)
- An Anthropic API key (optional; narrative generation only)

### Environment Variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (backend only) |
| `JWT_SECRET` | ✅ | Secret for operator + agent JWT signing |
| `REDIS_URL` | ✅ | Redis connection string |
| `CLOUDAMQP_URL` | ☑️ | RabbitMQ URL (async enrichment) |
| `ANTHROPIC_API_KEY` | ☑️ | Platform-level fallback Anthropic key |
| `DEMO_MODE` | ☑️ | `true` enables sandbox auth bypass |
| `PRODUCT_OFFERING` | ☑️ | `BASIC` or `ADVANCED` (feature tier gate) |
| `FT_API_URL` / `FT_API_KEY` | ☑️ | FastTrack CRM integration |

### Running the Backend

```bash
cd backend
npm install
npm run dev          # nodemon, port 5000
```

First-time setup:

```bash
node scripts/bootstrap-ml-engines.js   # initialise ML models
node scripts/apply-migration.js        # run DB migrations
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev          # Vite, proxies /api → localhost:5000
```

### Building the SDK

```bash
cd sdk
npm install
npm run build        # rollup → dist/
```

---

## Database Migrations

All migrations live in `backend/migrations/`. Apply them in order using the helper:

```bash
node scripts/apply-migration.js
```

Key migration milestones:

| Migration | Description |
|---|---|
| `001_initial_schema.sql` | Core schema |
| `20260308_f11_duty_of_care.sql` | F11 behavioural rule engine |
| `20260411_ml_enriched_alerts.sql` | ML-enriched alert fields |
| `20260414_player_archetypes.sql` | Archetype classification table |
| `20260414_regulatory_reports.sql` | LLM report storage |
| `20260414_ai_operator_config.sql` | Per-operator AI key config |

---

## SDK Usage

```js
import { NeoStrikeProvider, useNeoStrike } from '@neostrike/sdk';

function App() {
  return (
    <NeoStrikeProvider apiUrl="https://your-backend.com" brandId="1">
      <Dashboard />
    </NeoStrikeProvider>
  );
}

function Dashboard() {
  const { player, compliance } = useNeoStrike();
  // player.riskScore, player.archetype, compliance.alerts …
}
```

---

## Security

- **Helmet** CSP, HSTS, and security headers on all responses
- **Rate limiting**: global 1 000 req/15 min; auth endpoints 20 req/hr
- **JWT**: RS256 operator tokens; scoped AFA agent tokens
- **Anthropic keys**: AES-256 encrypted at rest; never logged or returned
- **RLS**: Supabase Row-Level Security enforces `brand_id` isolation
- **Audit log**: every sensitive operation writes a correlation-ID-stamped record

---

## Operator Portal

The React portal (`frontend/src/portal/`) gives compliance teams:

- **Compliance Monitor** — live event stream + alert triage
- **Player Risk Profiles** — archetype, trajectory, intervention history
- **AI Insights Settings** — Anthropic key management + cost dashboard
- **Regulatory Reports** — LLM-generated report drafts, downloadable
- **Agent Tokens** — issue and revoke AFA JWT tokens
- **T3 Approval Queue** — human-in-the-loop action review
- **Consultant Dashboard** — cross-brand risk analytics

---

## Project Structure

```
.
├── backend/
│   ├── middleware/      # auth, afa-auth, afa-policy, feature-gate, sandbox
│   ├── migrations/      # SQL migration files
│   ├── models/          # Pre-trained ML model JSON files
│   ├── routes/          # Express route handlers
│   ├── scripts/         # DB bootstrap, ML training, data sync
│   └── services/        # Business logic (compliance, ML, Anthropic, AFA, wallet …)
├── frontend/
│   └── src/
│       ├── player/      # Player-facing views (login, dashboard, lobby)
│       └── portal/      # Operator command centre
├── sdk/
│   └── src/             # NeoStrikeClient + React hooks
└── scripts/             # Root-level dev utilities
```

---

## License

Private — NeoStrike / FastTrack internal project.
