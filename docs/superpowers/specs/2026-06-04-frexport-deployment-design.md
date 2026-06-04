# frexport Deployment Design

**Date:** 2026-06-04
**Status:** Approved
**Goal:** Deploy frexport as a publicly accessible web service on Railway, hardened against abuse and cost runaway.

---

## Context

frexport is a local-first tool: a Fastify server drives headless Chromium to export
published Framer sites into static `.zip` bundles, streaming progress over SSE. Today it
binds to `127.0.0.1`, runs via `tsx` (no build step), keeps job state in an in-memory
`JobRegistry`, and writes zips to the OS tmp dir. There is no auth, rate limiting, URL
validation, or resource capping.

This design takes that single-process app to a **public, no-login** deployment on **Railway**
(container PaaS), with a **portable Dockerfile**, and a **locked-down** security/cost posture.

### Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Audience | Public — anyone with the link, no login |
| Hosting | Container PaaS → **Railway** (Dockerfile portable to Fly/Render) |
| Architecture | **Approach A** — single hardened container; no datastore, no queue service |
| Guardrails | **Lock down hard** — strict limits, full SSRF guard |
| SSRF depth | **Full** — DNS resolution + IP-range checks + redirect re-validation |
| Production run | **Real `tsc` build** → `node dist/index.js` (not `tsx`) |
| Egress control | **App-layer SSRF guard only** (no platform egress firewall) |

### Non-goals (YAGNI)

- No web/worker split, no Redis/queue service, no object storage/CDN (Approaches B/C).
- No persistent job state — a dropped export is simply re-run.
- No auth, accounts, or per-user quotas.
- No metrics/tracing stack — structured logs to Railway's log view suffice.

---

## Architecture

Single Node process in one Docker container on Railway. The existing in-memory
`JobRegistry` and `/tmp` zip storage are retained. Three guardrails sit in front of the
existing `/export` handler; a background sweeper bounds memory and disk.

```
                    Railway edge (TLS + $PORT + domain)
                              │
                    ┌─────────▼──────────┐
                    │  Fastify (0.0.0.0)  │
                    │                     │
   static web/ ◀────┤  GET  /             │
                    │  GET  /healthz      │
                    │  POST /export ──────┼──▶ [rate-limit] ▶ [SSRF guard]
   SSE     ◀────────┤  GET  /export/:id/  │      ▶ [concurrency gate] ▶ runExport()
   zip     ◀────────┤  GET  .../download  │                              │
                    └─────────────────────┘                       headless Chromium
                              │                                          │
                         in-mem jobs                                /tmp/<job>.zip
                              │                                          │
                         TTL sweeper ──── deletes finished jobs + zips after JOB_TTL_MS
```

On the `/export` path, checks run cheapest-rejection-first: **rate-limit → SSRF guard →
concurrency gate**. `runExport` is unchanged except for receiving config-injected limits.

### Behavioral change: queued jobs

Today `/export` starts the export immediately on a fire-and-forget promise. With a
concurrency gate of `MAX_CONCURRENT` (default 2), excess requests must **queue** rather
than run. A job therefore gains a `queued` state preceding `running`. The SSE stream
emits a waiting event (`{ phase: 'queued', position: N }`) so the UI can show queue
position. Past `MAX_QUEUE` (default 20) pending jobs, `/export` returns `503`.

---

## Components

Each is a small, independently testable unit.

### 1. `src/config.ts`

Reads environment once at boot, applies locked defaults, exports a typed `Config` object.
Invalid/missing values fall back to defaults (never crash on bad input). The resolved
config is logged once at startup.

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | bind port (Railway injects) |
| `HOST` | `0.0.0.0` (prod) / `127.0.0.1` (dev) | bind address |
| `RATE_MAX` | `5` | per-IP exports per window |
| `RATE_WINDOW` | `10m` | rate-limit window |
| `MAX_CONCURRENT` | `2` | parallel exports |
| `MAX_QUEUE` | `20` | queued jobs before `503` |
| `MAX_PAGES` | `25` | crawl page cap |
| `EXPORT_TIMEOUT_MS` | `90000` | per-export wall-clock |
| `MAX_ZIP_MB` | `150` | output size cap |
| `JOB_TTL_MS` | `900000` | sweeper retention for finished jobs |

`NODE_ENV=production` selects the prod `HOST` default and enables the logger.

### 2. `src/server/url-guard.ts` — SSRF protection

A single exported `assertPublicUrl(url: string): Promise<void>` that throws on a
disallowed URL. Checks:

- Scheme must be `http` or `https` (reject `file:`, `ftp:`, `data:`, etc.).
- Reject embedded credentials (`user:pass@`) and non-standard ports.
- **DNS-resolve the hostname** and reject if any resolved address falls in a
  private/loopback/link-local/reserved range:
  `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`
  (incl. cloud metadata `169.254.169.254`), `0.0.0.0/8`, `::1`, `fc00::/7`, `fe80::/10`,
  IPv4-mapped IPv6 equivalents.

Used at **two enforcement points** (Section: SSRF wiring).

### 3. `src/server/gate.ts` — concurrency gate

A semaphore admitting up to `MAX_CONCURRENT` exports. Excess callers queue (FIFO). Exposes
queue position for SSE. Rejects when pending depth exceeds `MAX_QUEUE`. Releases a slot on
job completion (success or failure) and promotes the next queued job.

### 4. `src/server/sweeper.ts` — TTL cleanup

A periodic sweep (interval derived from `JOB_TTL_MS`) that removes `done`/`error` jobs
older than `JOB_TTL_MS` from the registry and `unlink`s their zip files. Leaves
`running`/`queued`/fresh jobs untouched. Accepts an injected clock for deterministic tests.

### 5. Rate limit — `@fastify/rate-limit`

Per-IP limit (`RATE_MAX`/`RATE_WINDOW`) on `POST /export`, plus a global ceiling. Uses the
real client IP via Fastify `trustProxy: true` behind Railway's proxy. Returns `429` with
`Retry-After`.

### 6. Per-export limits

`MAX_PAGES`, `EXPORT_TIMEOUT_MS`, and `MAX_ZIP_MB` are passed into `runExport`. On timeout,
the browser is aborted and the job fails cleanly. On zip-size breach, the export aborts.

---

## SSRF wiring into the pipeline

The guard cannot live only at the HTTP handler — `runExport` performs server-side fetches
in three places, each an SSRF vector:

1. `detectFramer(url)` — `fetch()` the submitted URL.
2. `discoverRoutes` — `fetch()` `sitemap.xml`; Playwright `page.goto()` of crawled links.
3. `gapFillCss` / interceptor refetch — `fetch()` asset URLs found in CSS/JS.

A handler-only check misses #2 and #3: a public page can link to or 302-redirect toward an
internal host. Therefore `assertPublicUrl` is enforced at **two points**:

- **Entry gate** — `/export` calls it once on the submitted URL → fast `400` before any
  browser starts.
- **Per-navigation gate** — inside the pipeline:
  - A **Playwright route interceptor** calls `assertPublicUrl` on every outbound request and
    `abort()`s failures. Redirects surface as separate requests, so each hop is re-checked
    automatically.
  - Standalone `fetch()` calls (`detectFramer`, sitemap, gap-fill) are wrapped with the same
    assertion, using `redirect: 'manual'` and re-asserting each hop.

**Orthogonality:** the SSRF guard runs on *every* outbound URL regardless of the localizer's
localize/external classification. `framerusercontent.com` passes the guard (public) and is
localized; `10.0.0.5` is aborted before classification.

**Failure behavior:** a blocked sub-resource mid-crawl is non-fatal — recorded in the
report's `failed` list, export continues (consistent with existing best-effort asset
handling). A blocked *initial* URL is fatal (the entry `400`).

---

## Container & Railway configuration

### Dockerfile (multi-stage)

- **Build stage:** `node:22-bookworm-slim`, `npm ci`, `npm run build` (tsc → `dist/`).
- **Runtime stage:** official `mcr.microsoft.com/playwright:v1.50.0-noble` image (Chromium +
  system libs version-matched to the `playwright` npm version), `npm ci --omit=dev`, copy
  `dist/` and `web/`, run as non-root `pwuser`, `CMD ["node","dist/index.js"]`.

The Playwright base image version **must** track the `playwright` dependency version to
avoid browser/lib mismatch.

### Build step (new)

Add `"build": "tsc"` to `package.json`; emit to `dist/` (already configured in
`tsconfig.json` via `outDir: dist`). Production runs the compiled output; `tsx` stays a dev
dependency only. Typecheck becomes a build gate.

### `.dockerignore`

Exclude `node_modules`, `.git`, `test`, `site/`, `tmp/`, `*.log`, `docs/`.

### Railway / Fastify changes

- Bind `HOST` (`0.0.0.0` in prod) — currently hardcoded `127.0.0.1`, which would make the
  container unreachable.
- `trustProxy: true` so rate-limit sees the real client IP.
- `logger: true` in production.
- `GET /healthz` → `200` for Railway's healthcheck (keeps `/` for the UI).
- Optional `railway.json` pinning healthcheck path and restart policy.
- No volume — `/tmp` zips are ephemeral by design (sweeper + restart clear them).

---

## Observability

- Fastify structured logger on in production. One-line events for: job
  created/queued/started/done/failed, SSRF rejections, rate-limit hits, sweeper deletions.
- Resolved config logged once at boot.
- No external metrics/tracing (single instance; YAGNI).

---

## Testing strategy

New units are unit-tested in isolation, matching the existing suite's style.

- **`url-guard.test.ts`** (highest value) — table-driven: `localhost`, `127.0.0.1`,
  `169.254.169.254`, `10.x`, `192.168.x`, `::1`, `fc00::`, credentials-in-URL, `file://`,
  non-standard ports → rejected; real public hosts → pass; plus a redirect-hop re-check.
- **`gate.test.ts`** — admits up to N, queues the rest, releases on completion, rejects past
  `MAX_QUEUE`.
- **`sweeper.test.ts`** — deletes expired done/error jobs + unlinks zips; leaves
  running/fresh jobs; uses injected clock (no real timers).
- **`config.test.ts`** — defaults applied, overrides honored, bad values fall back.
- **Server integration** (extend `server.test.ts`) — rate-limit `429`, SSRF URL `400`,
  queue-full `503`, `/healthz` `200`.

Browser-driving units (renderer, pool, pipeline) are unchanged in logic — only their limits
are now config-injected — so existing integration/e2e tests remain valid.

The Dockerfile is not unit-tested; verification is a **documented manual step**:
`docker build`, run locally, export the fixture site, confirm the resulting zip.

---

## Deliverables

- `src/config.ts`
- `src/server/url-guard.ts`, `src/server/gate.ts`, `src/server/sweeper.ts`
- `@fastify/rate-limit` integration in `src/server/server.ts`
- `queued` job state + SSE event in `JobRegistry` and the UI
- SSRF enforcement wired into `pipeline.ts` (entry gate + Playwright route interceptor +
  wrapped `fetch` calls)
- Per-export limits (`MAX_PAGES`, `EXPORT_TIMEOUT_MS`, `MAX_ZIP_MB`) threaded into `runExport`
- `Dockerfile`, `.dockerignore`, `"build"` script, `0.0.0.0`/`trustProxy`/`logger`/`/healthz`
  changes
- `railway.json` (optional) + a Railway deploy doc/README section
- Unit + integration tests above
