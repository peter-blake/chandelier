# Chandelier — Architecture Reference

This document covers implementation patterns. Claude Code should read this before writing pipeline code.

---

## The Bulb Pattern — Canonical Implementation

Every Bulb follows this exact flow. No deviations without explicit justification.

```
Request arrives
    │
    ▼
Idempotency check  ← MUST run before payment verification
    │ Cache hit → return cached response (200, no payment attempted)
    │ Cache miss →
    ▼
x402 middleware (payment verification)
    │ Payment invalid → 402 + top_up_url (abort, stop here)
    │ Payment valid →
    ▼
Log: { event: "payment_verified", ... }
    │
    ▼
Input validation (Zod)
    │ Invalid → 400 + validation errors (abort)
    │ Valid →
    ▼
Exa searchAndContents() [with 3s timeout via Promise.race()]
    │ Timeout → 503 + retry_after (abort — caller retries with same Idempotency-Key, no re-charge)
    │ Error → 503 (abort)
    │ Success →
    ▼
Log: { event: "exa_complete", exa_ms: N, ... }
    │
    ▼
Claude API (tool_choice structured output) [with 10s timeout]
    │ Malformed output → retry once with stricter prompt
    │   Retry fails → 422 (pipeline cost absorbed — no refund mechanism)
    │ Success →
    ▼
Log: { event: "claude_complete", claude_ms: N, ... }
    │
    ▼
Output validation (Zod) — validate Claude output matches schema
    │ Invalid → retry Claude once
    │   Retry fails → 422 (pipeline cost absorbed — no refund mechanism)
    │ Valid →
    ▼
Cache response (idempotency key → 5min TTL)
    │
    ▼
Log: { event: "response_delivered", total_ms: N, usdc_charged: "...", ... }
    │
    ▼
Return 200 + structured JSON + X-Chandelier-* headers
```

---

## Exa Client Pattern

```typescript
// src/lib/exa.ts

import Exa from 'exa-js'

const exa = new Exa(process.env.EXA_API_KEY!)

export interface ExaSearchOptions {
  query: string
  numResults?: number
  startPublishedDate?: string  // ISO date string
  useAutoprompt?: boolean
}

const EXA_TIMEOUT_MS = 3000

export async function searchAndContents(options: ExaSearchOptions) {
  const { query, numResults = 8, startPublishedDate, useAutoprompt = true } = options

  // Always use searchAndContents — single call, not search + getContents separately
  const searchPromise = exa.searchAndContents(query, {
    type: 'auto',         // 'neural' is the old API term — 'auto' is current equivalent
    numResults,
    useAutoprompt,
    startPublishedDate,
    text: {
      maxCharacters: 2000,  // 8 results × 2000 chars = ~16k chars to Claude. Cost-controlled.
    },
  })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('EXA_TIMEOUT')), EXA_TIMEOUT_MS)
  )

  const result = await Promise.race([searchPromise, timeoutPromise])
  return result.results
}
```

**Key constraint:** Always use `searchAndContents()` — never `search()` followed by `getContents()`. One API call per Bulb invocation, not two.

---

## Claude Structured Output Pattern

```typescript
// src/lib/claude.ts

import Anthropic from '@anthropic-ai/sdk'
import { zodToJsonSchema } from 'zod-to-json-schema'  // static import — not dynamic
import { z } from 'zod'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function synthesizeStructured<T>(params: {
  systemPrompt: string
  userContent: string
  outputSchema: z.ZodType<T>
  toolName: string
  toolDescription: string
}): Promise<T> {
  const { systemPrompt, userContent, outputSchema, toolName, toolDescription } = params

  // Convert Zod schema to JSON Schema for Claude tool definition
  const jsonSchema = zodToJsonSchema(outputSchema, { target: 'openApi3' })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',  // Current Sonnet model — do not use claude-sonnet-4-20250514 (old)
    max_tokens: 2048,            // 1024 is insufficient for full Company Intelligence output
    system: systemPrompt,
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: jsonSchema as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool', name: toolName },  // Force structured output
    messages: [{ role: 'user', content: userContent }],
  })

  // Extract tool use block
  const toolUseBlock = response.content.find(block => block.type === 'tool_use')
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a tool use block')
  }

  // Validate output against Zod schema
  const parsed = outputSchema.safeParse(toolUseBlock.input)
  if (!parsed.success) {
    throw new Error(`Claude output failed schema validation: ${JSON.stringify(parsed.error.errors)}`)
  }

  return parsed.data
}
```

---

## x402 Middleware Integration

```typescript
// src/middleware/x402.ts
// The @x402/express package handles the 402 flow.
// Pattern is: paymentMiddleware(walletAddress, { "/v1/route": "$0.25" })

import { paymentMiddleware } from '@x402/express'

export function createPaymentMiddleware() {
  return paymentMiddleware(
    process.env.PAYMENT_ADDRESS!,
    {
      '/v1/company-intelligence': `$0.25`,
      '/v1/outbound-personalization': `$0.15`,
      // Add new Bulbs here as they ship
    },
    {
      facilitatorUrl: process.env.PAYMENT_FACILITATOR_URL!,
      network: process.env.NETWORK as 'base' | 'base-sepolia',
    }
  )
}
```

**Note:** Confirm exact `paymentMiddleware` signature against `@x402/express` docs at https://github.com/coinbase/x402 before implementing. The package was at v0.x as of early 2026 — API surface may have evolved.

---

## Response Headers Middleware

```typescript
// Always attach these to paid responses
res.set('X-Chandelier-Bulb', 'active')
res.set('X-Chandelier-Cost', chargedAmount)  // e.g. "0.25"
res.set('X-Chandelier-Latency', JSON.stringify({ exa_ms, claude_ms, total_ms }))
```

---

## Idempotency Cache Pattern

```typescript
// src/middleware/idempotency.ts
// In-memory cache only — no Redis, no database
import { Request, Response, NextFunction } from 'express'

const cache = new Map<string, { response: unknown; expiresAt: number }>()
const TTL_MS = 5 * 60 * 1000  // 5 minutes

export function getCached(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.response
}

export function setCached(key: string, response: unknown): void {
  cache.set(key, { response, expiresAt: Date.now() + TTL_MS })
}

// Middleware — must be mounted BEFORE x402 payment middleware
// If cache hits, response is returned before payment is ever attempted (prevents double-charge)
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['idempotency-key']
  if (key) {
    const cached = getCached(key as string)
    if (cached) {
      res.status(200).json(cached)
      return
    }
    // Attach to res.locals so pipeline can cache after completion
    res.locals.idempotencyKey = key
  }
  next()
}
```

---

## Error Response Shapes

```typescript
// 402 Payment Required
{
  "error": "payment_required",
  "message": "This endpoint requires a USDC micropayment via x402",
  "top_up_url": "https://chandelier.dev/top-up",  // or Bazaar URL
  "amount_required": "0.25",
  "currency": "USDC",
  "network": "base"
}

// 503 Upstream Failure (Exa timeout)
{
  "error": "upstream_unavailable",
  "message": "Retrieval service temporarily unavailable",
  "retry_after": 5,  // seconds
  "charged": false
}

// 422 Synthesis Failure (Claude malformed)
{
  "error": "synthesis_failed",
  "message": "Unable to generate structured output after retry",
  "charged": false
}

// 429 Rate Limit
{
  "error": "rate_limited",
  "message": "Request rate exceeded",
  "retry_after": 60,
  "top_up_url": "https://chandelier.dev/top-up"
}
```

---

## Manifest Endpoint Shape (Bulb 0)

```typescript
// GET /manifest — never gated, always free
{
  "version": "1.0.0",
  "network": "base-sepolia",  // or "base"
  "health": "ok",
  "bulbs": [
    {
      "bulb_id": "company-intelligence",
      "name": "Company Intelligence Brief",
      "description": "Structured intelligence brief on any company: news, hiring, leadership, funding.",
      "endpoint": "/v1/company-intelligence",
      "price_usdc": "0.25",
      "schema_url": "/v1/company-intelligence/schema",
      "sample_url": "/v1/company-intelligence/sample",
      "status": "active",
      "llm_usage_prompt": "Use this endpoint when you need current intelligence on a company..."
    }
  ],
  "payment": {
    "protocol": "x402",
    "network": "base",
    "currency": "USDC",
    "facilitator": "https://x402.org/facilitator"
  }
}
```

---

## TypeScript Config (Recommended)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Dependencies to Install

```bash
npm install express @x402/express exa-js @anthropic-ai/sdk zod zod-to-json-schema
npm install -D typescript @types/node @types/express ts-node nodemon
```

MCP server (Phase 2):
```bash
npm install @modelcontextprotocol/sdk
# x402-mcp: check github.com/coinbase/x402 for current package name
```

---

## Testnet Setup Checklist

Before running a single line of code:

- [ ] Base Sepolia wallet created (MetaMask or CDP wallet)
- [ ] Wallet address in `.env` as `PAYMENT_ADDRESS`
- [ ] QuickNode devnet USDC faucet hit — fund testnet wallet
- [ ] `EXA_API_KEY` set (exa.ai account)
- [ ] `ANTHROPIC_API_KEY` set (console.anthropic.com)
- [ ] `CDP_API_KEY_NAME` + `CDP_API_KEY_PRIVATE_KEY` set (docs.cdp.coinbase.com)
- [ ] `NETWORK=base-sepolia` confirmed in `.env`
- [ ] `PAYMENT_FACILITATOR_URL=https://x402.org/facilitator` set

First test: `curl http://localhost:3000/health` should return `{ "status": "ok", "network": "base-sepolia" }`.

Second test: `curl -X POST http://localhost:3000/v1/company-intelligence -H "Content-Type: application/json" -d '{"company":"Stripe"}'` should return a 402 with correct body (no wallet payment attached).
