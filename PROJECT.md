# Chandelier — Project Tracker

> Single source of truth for build status. Updated at the end of every working session.
> See `CLAUDE.md` Law #13 for update rules.

**Last updated:** 2026-03-05 (session 2)
**Current phase:** Phase 1 complete — Phase 2 next
**Repo:** https://github.com/peter-blake/chandelier
**Network:** Base Sepolia (testnet)

---

## Phase 1 — Testnet Scaffold ✅ Complete

- [x] `package.json` + TypeScript config (NodeNext, strict mode, ESM)
- [x] Environment validation at startup — throws and exits if any required var missing
- [x] `GET /health` — returns `{ status, network }`
- [x] `GET /manifest` — Bulb 0, always free, machine-readable inventory
- [x] Idempotency middleware — in-memory 5min TTL, mounted **before** x402
- [x] x402 payment middleware — `ExactEvmScheme`, `x402ResourceServer`, eip155 network IDs, mounted at app root for full versioned path matching
- [x] Exa client — `searchAndContents`, `Promise.race` 3s timeout, `type: "auto"`
- [x] Claude client — `tool_choice` structured output, `claude-sonnet-4-6`, `max_tokens: 2048`
- [x] Bulb 1 — Company Intelligence pipeline (Exa → Claude with one retry on synthesis failure)
- [x] `POST /v1/company-intelligence` — 402 gated
- [x] `GET /v1/company-intelligence/schema` — free
- [x] `GET /v1/company-intelligence/sample` — free, cached Stripe example
- [x] State machine logging — `payment_verified → exa_complete → claude_complete → response_delivered`
- [x] `X-Chandelier-Bulb`, `X-Chandelier-Cost`, `X-Chandelier-Latency` response headers

**Verified working (2026-03-05):**
- `GET /health` → 200
- `GET /manifest` → 200, full Bulb inventory
- `POST /v1/company-intelligence` (no payment) → 402
- `POST /v1/company-intelligence` (with payment) → 200, real Exa + Claude intelligence
- `GET /v1/company-intelligence/schema` → 200
- `GET /v1/company-intelligence/sample` → 200

---

## Phase 2 — MCP + Discovery ⏳ Up Next

- [ ] MCP server entry point (`mcp-server/index.ts`)
- [ ] MCP tool definition for `company-intelligence` (`mcp-server/tools/company-intelligence.ts`)
- [ ] `llms.txt` at repo root — agent-readable summary of Bulbs, pricing, and payment flow
- [ ] Bazaar registration metadata
- [ ] `README.md` — developer-facing: how to run locally, how to add a Bulb, how to use the MCP server

---

## Phase 3 — Bulb 2 (Outbound Personalization) 🔲 Scheduled

> Build only after Phase 2 is complete.

- [ ] `POST /v1/outbound-personalization` — $0.15, 402 gated
- [ ] `GET /v1/outbound-personalization/schema` — free
- [ ] `GET /v1/outbound-personalization/sample` — free
- [ ] Two parallel Exa queries (prospect + company)
- [ ] Add to x402 route config
- [ ] Add to manifest
- [ ] MCP tool definition

---

## Parking Lot — Not Scheduled

- **Bulb 2 (AI Vulnerability Scoring)** — Needs pricing validation before build. See `BULBS.md` for open questions.
- **Competitive Intelligence Bulb** — Concept only. See `BULBS.md`.
- **Intent Data Bulb** — Concept only. See `BULBS.md`.
- **CDP Builder Grant** — Apply after Bulb 1 is live on mainnet. Check cdp.coinbase.com for cohort dates.
- **Twitter launch** — Do not engage until working curl command exists on mainnet.
- **Mainnet deployment** — After Phase 2. Requires switching `NETWORK=base` and funding wallet with real USDC.

---

## Open Issues

- `top_up_url` in 402 body points to `https://chandelier.dev/top-up` — placeholder until landing page exists

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-05 | `type: "auto"` instead of `"neural"` in Exa client | `"neural"` is deprecated Exa API terminology — `"auto"` is the current equivalent |
| 2026-03-05 | `claude-sonnet-4-6` instead of `claude-sonnet-4-20250514` | Old model ID — updated to current Sonnet |
| 2026-03-05 | `max_tokens: 2048` instead of `1024` | 1024 insufficient for full Company Intelligence output schema |
| 2026-03-05 | Idempotency middleware mounts before x402 | x402 settles payment at middleware layer — idempotency must check cache before payment is attempted to prevent double-charging on retries |
| 2026-03-05 | x402 mounted at app root, not `/v1` | Middleware mounted under a path prefix has that prefix stripped — mounting at root lets route keys use full versioned paths (`POST /v1/company-intelligence`) consistent with API versioning convention |
| 2026-03-05 | `ExactEvmScheme` + `x402ResourceServer` + `HTTPFacilitatorClient` | Actual `@x402/express` API differs significantly from original ARCHITECTURE.md doc — updated to match real package (requires `@x402/evm` as separate install) |
| 2026-03-05 | Law #4 reframed as "Guarantee Delivery, Not Refunds" | x402 settles payment before pipeline runs — no refund mechanism exists. Correct commitment is aggressive retry before failure, not charge reversal |
| 2026-03-05 | `unpaidResponseBody` callback per route in x402 config | Enables per-Bulb 402 bodies with correct `amount_required` — scales cleanly when new Bulbs are added |
