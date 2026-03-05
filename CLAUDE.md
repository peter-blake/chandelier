# Chandelier — Claude Code Instructions

> **Agentic payments are coming. Start here.**

This is the authoritative instruction file for Claude Code working on the Chandelier project. Read this before touching any code. Then read `BULBS.md` before implementing any endpoint.

---

## What We Are Building

Chandelier is an **open-source, agent-first API platform** built on the x402 micropayment protocol. Individual paid endpoints are called **Bulbs**. Each Bulb:

1. Accepts a USDC micropayment via x402
2. Runs a pipeline: Exa semantic search → Claude AI synthesis
3. Returns structured JSON intelligence

**Primary customer: AI agents, not humans.** Developers are the distribution gateway during launch. The long-term flywheel is autonomous agent discovery via Coinbase Bazaar, MCP servers, and llms.txt.

**Current phase:** Plan → Build. Nothing is shipped. No code exists yet. We are building the Bulb 1 scaffold on **Base Sepolia testnet** first.

---

## Tech Stack — Exact Package References

| Layer | Package | Notes |
|-------|---------|-------|
| Runtime | Node.js + TypeScript | Strict mode. No `any`. |
| Payment middleware | `@x402/express` | Intercepts requests, triggers 402 |
| Payment facilitator | Coinbase CDP (`@coinbase/cdp-sdk`) | Base Mainnet prod / Base Sepolia testnet |
| Retrieval | `exa-js` | Use `searchAndContents()` exclusively — one call, not separate search + fetch |
| Synthesis | `@anthropic-ai/sdk` | Structured JSON output via tool_choice enforcement |
| Schema validation | `zod` | Strict. All inputs AND outputs schema-enforced |
| MCP server | `@modelcontextprotocol/sdk` + `x402-mcp` | Wrap every Bulb as an MCP tool |

**Do NOT** install or use: databases, ORMs, auth libraries, session middleware, frontend frameworks.

---

## The Laws — Non-Negotiable Build Rules

### 1. Charge Last Principle
**Sequence is sacred:** `Verify Payment → Call Exa → Call Claude → Return Response`

Never call Exa or Claude before payment is verified. If the payment check fails, abort immediately with 402.

### 2. Every Bulb Exposes Three Routes

```
POST   /v1/{bulb-name}          # Paid intelligence endpoint (x402 gated)
GET    /v1/{bulb-name}/schema   # Returns Zod input/output schemas as JSON (FREE)
GET    /v1/{bulb-name}/sample   # Returns cached example response (FREE)
```

### 3. Strict JSON Enforcement
Use `tool_choice: { type: "tool", name: "structured_output" }` on every Claude call. Zero conversational filler. If Claude returns malformed output: retry once with stricter prompt. If it fails again: return 422.

### 4. Failure Handling — Guarantee Delivery, Not Refunds
x402 settles payment at the middleware layer, before the pipeline runs. There is no refund mechanism once payment is verified. The commitment is therefore: **retry aggressively before failing, never fail silently.**

- **Exa timeout (>3s):** Return 503 with `retry_after`. Exa was never called successfully so pipeline cost is zero — but payment has already cleared. The 503 tells the caller to resubmit with the same `Idempotency-Key`; because idempotency runs BEFORE x402, the retry returns cached response without re-charging.
- **Claude malformed output:** Retry once with stricter prompt before returning 422. One retry is mandatory — do not fail on first malformed response.
- **Payment verified but pipeline fails (dead-letter):** Log to stdout in dead-letter JSON format. Never swallow errors silently.

### 5. Idempotency
Accept `Idempotency-Key` header on all paid endpoints. Cache response for 5 minutes. Replay without re-charging.

### 6. Required Response Headers
Every response must include:
```
X-Chandelier-Bulb: active
X-Chandelier-Cost: <actual USDC charged>
X-Chandelier-Latency: {"exa_ms": N, "claude_ms": N, "total_ms": N}
```

### 7. Error as Data
- **402 (Payment Required):** Must include `top_up_url` in body.
- **429 (Rate Limit):** Must include `retry_after` AND `top_up_url`. Never return a bare 429.
- **503 (Upstream failure):** Must include `retry_after`.

### 8. Bulb 0 — Manifest Endpoint (Always FREE)
```
GET /manifest
```
Returns active Bulbs, current pricing, health status. This is how agents discover the platform. Never gate this behind payment.

### 9. Versioning
All paid endpoints versioned: `/v1/`. Breaking changes require `/v2/`. Never deprecate silently.

### 10. Statelessness — Absolute
No database. No user accounts. No sessions. No persistent server state. Log ALL transactions to stdout as structured JSON. If you feel the urge to persist state, stop and flag it.

### 11. Secret Management
Secrets via environment variables only. Never hardcode. Required vars:
```
EXA_API_KEY
ANTHROPIC_API_KEY
CDP_API_KEY_NAME
CDP_API_KEY_PRIVATE_KEY
PAYMENT_FACILITATOR_URL   # CDP facilitator endpoint
NETWORK                   # "base-sepolia" (testnet) | "base" (mainnet)
PORT                      # default 3000
```
If any of these are missing at startup, the server must throw and exit — not silently degrade.

### 13. Project Tracker — Always Current

`PROJECT.md` is the single source of truth for build status. At the end of any session where code is written, fixed, or decisions are made:

- Update task checkboxes to reflect what was completed (check off done items, add new items)
- Move completed phases to ✅, active phases to ⏳
- Add any architectural decisions to the Decision Log with date and rationale
- Update the "Last updated" date at the top
- Add new open issues, or remove issues that were resolved
- Keep the Parking Lot current — things deprioritised should land there, not be deleted

`PROJECT.md` must always reflect the actual current state of the codebase. Never leave it stale after a working session.

---

### 12. State Machine Logging
Every paid request is a state machine. Log transitions to stdout:
```json
{"event": "payment_verified", "bulb": "company-intelligence", "idempotency_key": "...", "ts": "..."}
{"event": "exa_complete", "bulb": "company-intelligence", "exa_ms": 812, "ts": "..."}
{"event": "claude_complete", "bulb": "company-intelligence", "claude_ms": 1204, "ts": "..."}
{"event": "response_delivered", "bulb": "company-intelligence", "total_ms": 2016, "usdc_charged": "0.25", "ts": "..."}
```

---

## Recommended Project Structure

```
chandelier/
├── CLAUDE.md                    # This file
├── BULBS.md                     # Bulb specs and decision log
├── ARCHITECTURE.md              # Implementation patterns
├── CONTEXT.md                   # Project background and decisions
├── .env.example                 # All required env vars (no values)
├── .env                         # Local secrets — NEVER commit
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts                # Express app entry point
│   ├── middleware/
│   │   ├── x402.ts              # Payment verification middleware
│   │   └── idempotency.ts       # Idempotency key cache (in-memory, 5min TTL)
│   ├── bulbs/
│   │   ├── index.ts             # Bulb router — mounts all Bulbs
│   │   ├── company-intelligence/
│   │   │   ├── index.ts         # Route handler (POST + schema + sample)
│   │   │   ├── schema.ts        # Zod input/output schemas
│   │   │   ├── pipeline.ts      # Exa → Claude pipeline
│   │   │   ├── prompt.ts        # Claude system prompt (proprietary)
│   │   │   └── sample.json      # Cached example response
│   │   └── [future-bulbs]/
│   ├── lib/
│   │   ├── exa.ts               # Exa client wrapper with retry + timeout
│   │   ├── claude.ts            # Claude client wrapper with structured output
│   │   └── logger.ts            # Structured JSON stdout logger
│   ├── manifest/
│   │   └── index.ts             # GET /manifest (Bulb 0)
│   └── llms.txt                 # Agent-consumable discovery doc (static serve)
├── mcp-server/
│   ├── index.ts                 # MCP server wrapping all Bulbs
│   └── tools/
│       └── company-intelligence.ts
└── tests/
    └── bulbs/
        └── company-intelligence.test.ts
```

---

## AEO (Agent Engine Optimization) Rules

These exist so AI agents can discover and use Chandelier autonomously:

1. **Every Bulb route has a Zod schema** for both Input and Output — exposed at `/v1/{bulb}/schema`
2. **Every Bulb has an MCP tool definition** in `mcp-server/tools/`
3. **`/llms.txt` at root** — agent-readable summary of all Bulbs, pricing, and payment flow
4. **`/manifest` (Bulb 0)** — machine-readable endpoint inventory with health status
5. **`llm_usage_prompt` per Bulb** — tells agents what this endpoint is for and when to call it

---

## What NOT to Build

- No frontend, dashboard, or UI of any kind
- No user accounts or subscription logic
- No persistent database
- No admin panel
- No webhook system (yet)
- No rate limiting beyond what x402 handles natively

If a feature increases latency without 10x utility gain, flag it before building.

---

## Development Sequence (Start Here)

**Phase 1 — Testnet scaffold (current)**
1. `npm init` + TypeScript config + strict ESLint
2. Express server boots, environment validation at startup
3. `GET /health` returns `{ status: "ok", network: "base-sepolia" }` — no payment
4. `GET /manifest` returns empty Bulbs array — no payment
5. x402 middleware wired — requests to paid routes return 402 with correct body
6. Exa client with `searchAndContents()` — test with hardcoded query
7. Claude client with structured JSON output — test with hardcoded prompt
8. Bulb 1 (Company Intelligence) pipeline working end-to-end on testnet
9. `/schema` and `/sample` routes for Bulb 1
10. Idempotency middleware
11. Full state machine logging

**Phase 2 — MCP + discovery**
- MCP server wrapping Bulb 1
- `llms.txt` and Bazaar registration metadata

**Phase 3 — Additional Bulbs**
- See `BULBS.md` for priority order and specs

---

## Key External References

- x402 SDK: https://github.com/coinbase/x402
- Exa docs: https://docs.exa.ai (use `searchAndContents()` — not `search` + `getContents` separately)
- Anthropic structured output: https://docs.anthropic.com/en/docs/tool-use (use `tool_choice` to force JSON)
- Coinbase CDP: https://docs.cdp.coinbase.com
- x402-mcp: https://github.com/coinbase/x402 (check /packages/x402-mcp)
- Awesome x402 (ecosystem reference): https://github.com/xpaysh/awesome-x402

**If a method signature is uncertain, state the uncertainty explicitly and reference the docs URL. Never guess at API signatures.**
