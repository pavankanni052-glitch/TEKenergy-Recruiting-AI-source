# TEKenergy Recruiting AI

A local-first, controlled recruiting operations application for TEKenergy. It supports job intake, candidate records and resume imports, evidence-based screening, recruiter-approved outreach, human-led interview coordination, shortlists, exports, and audit history.

This is a pilot application—not a production hiring decision system. It deliberately keeps consequential actions under recruiter control.

## What works now

- Job intake with documented requirement extraction, recruiter approval, versioned rubrics, and activation/pause/close controls.
- Candidate database with exact-match duplicate prevention, archiving/deletion support in the data layer, CSV/XLS/XLSX import, and PDF/DOCX/TXT resume preservation/parsing.
- Deterministic scoring in application code, with evidence for each requirement and the statuses `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNKNOWN`, `NOT_SUPPORTED`, and `REQUIRES_VERIFICATION`.
- Federal-specific documented requirement handling for work authorization, citizenship, Public Trust, and clearance; these are never inferred and must be verified.
- Internal candidate search, generated Boolean sourcing strings, and explicit recruiter-assisted sourcing tasks. No scraping, CAPTCHA bypassing, or fabricated source results.
- Outreach draft generation, approval gates, opt-out enforcement, copy-to-clipboard, manual-send recording, communication history, and duplicate-send prevention.
- Human-led interview coordination, structured question templates, feedback, and a deliberately disabled AI voice-interview integration placeholder.
- Evidence-based shortlist reports containing zero, one, or two candidates; approval, audit events, and authenticated JSON export.
- SQLite persistence, idempotent schema migration, audit events, background-task schema, integration state records, application restart persistence, and an external-action kill switch.

## Quick start

Prerequisites: Node.js 24+ and pnpm 11+.

```powershell
pnpm install
Copy-Item .env.example .env
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000/login](http://localhost:3000/login), then sign in with the local synthetic-demo account:

```text
Email: recruiter@tekenergy.demo
Password: TEKenergyDemo!2026
```

The SQLite database is created at `data/tekenergy.db`. Demo seed data contains one approved, active job and ten clearly labelled synthetic candidates. To reset only local demo data:

```powershell
pnpm db:reset-demo
pnpm db:seed
```

## Configuration

Copy `.env.example` to `.env`; do not commit `.env`.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `TEKENERGY_DEMO_MODE` | No | Keeps demo seed behavior enabled by default. |
| `SESSION_SECRET` | Yes for deployment | Replaces the development-only signed-session secret. |
| `OPENAI_API_KEY` | No | Enables live AI requirement extraction. Demo extraction works without it. |
| `OPENAI_MODEL` | No | Responses API model; default is `gpt-6-astra`. |
| `AI_MONTHLY_BUDGET_USD` | No | Deployment configuration placeholder for AI spending policy. |
| `OUTREACH_DAILY_LIMIT` | No | Deployment configuration placeholder for delivery-rate policy. |
| `EMAIL_*`, `CALENDAR_PROVIDER`, `SOURCING_PROVIDER` | No | Provider-adapter configuration placeholders. |
| `EXTERNAL_ACTIONS_ENABLED` | No | Defaults to false; keep false until provider testing and approvals are complete. |

The OpenAI adapter uses the Responses API as documented in the [official OpenAI quickstart](https://developers.openai.com/api/docs/quickstart). It treats job descriptions and resumes as untrusted content, limits text passed to the adapter, asks only for structured requirement extraction, and falls back to deterministic extraction on missing credentials or API errors.

## Integrations and live-operation status

| Area | Current behavior | Tested live? |
| --- | --- | --- |
| OpenAI | Optional Responses API adapter; deterministic fallback is active without a key. | No key supplied; demo fallback tested. |
| Email | Copy-to-clipboard and manual-send recording. Live provider adapter configuration is reserved for authorized credentials. | No. |
| Calendar | Manual coordination and scheduling status. | No. |
| External sourcing | Boolean strings and recruiter-assisted tasks; no direct scraping. | No. |
| AI voice interviews | Disabled pending provider, disclosure, consent, transcription, accessibility, and test controls. | No. |

The Settings page never reports a provider as connected until a provider-specific successful health check has been implemented and run.

## Verification

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The included unit/integration suite checks documented requirement extraction, mandatory-vs-preferred treatment, conservative missing-information behavior, verification-only clearance handling, prompt-injection marking, spreadsheet import validation, duplicate-safe lifecycle behavior, screening storage, sourcing tasks, approved outreach/manual send, responses, interviews, shortlist approval, and an acceptance-path synthetic candidate. The demo seed contains ten synthetic candidate profiles.

## Data, security, and deployment guidance

- The repository does not include a real candidate database, actual resumes, secrets, or live integration credentials.
- Candidate document uploads are size/type limited and stored locally; run behind authenticated storage and encrypted volumes before handling production PII.
- Replace demo authentication with an organization identity provider, enforce tenant/record ownership, rotate `SESSION_SECRET`, and use HTTPS plus secure cookies before deployment.
- Move SQLite to managed PostgreSQL for multi-instance deployments. The schema in `lib/db.ts` is relational SQL with standard foreign keys, timestamps, indexes, transactions, and JSON text fields; migrate it through a reviewed PostgreSQL migration process.
- Store production secrets in a deployment secret manager, not in SQLite or source control. Restrict OpenAI inputs to permitted information and never send CUI, classified, or restricted customer data to external services.
- Establish retention, deletion, consent, EEOC/privacy, message-rate, customer-submission, and security-review policies before processing actual candidate data.
- The app does not autonomously contact candidates, call candidates, reject candidates, submit candidates to clients, or make a hiring decision.

## Project map

- `app/` — Next.js dashboard, routes, server actions, and protected export endpoint.
- `lib/db.ts` — SQLite initialization, idempotent migration, transaction, audit, and setting helpers.
- `lib/repository.ts` — relational workflow persistence and safety controls.
- `lib/intelligence.ts` — safe extraction, deterministic evidence/scoring, Boolean strings, outreach, and interview questions.
- `lib/parsers.ts` — CSV/XLS(X), DOCX, PDF, and text resume import parsing.
- `tests/` and `e2e/` — unit/integration and browser smoke tests.
- `.env.example` — non-secret configuration template.

## Known limitations

This pilot intentionally does not ship live email/calendar/sourcing/voice adapters because credentials, provider scopes, legal consent requirements, and end-to-end provider tests are not available in this workspace. Its role model is suitable for a local pilot but needs enterprise SSO, provisioning, stronger record-level authorization, rate-limit enforcement, encrypted object storage, and a PostgreSQL migration before production use.
