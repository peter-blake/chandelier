# Chandelier — Bulb Specifications

> Read this before implementing any Bulb. This is the source of truth for what to build, why, and in what order.

---

## Decision Log on Bulb Selection

The reference documentation lists three Bulbs and five ecosystem gap opportunities. This file documents what is confirmed, what is under consideration, and what has been deprioritised — and the reasoning behind each.

**The three reference Bulbs remain the core set.** However, they are not equally validated. Here is the honest status:

| Bulb | Status | Confidence | Notes |
|------|--------|------------|-------|
| Company Intelligence Brief | ✅ Build first | High | Demo centerpiece. Clearest pipeline. |
| Outbound Personalization | ✅ Build second | High | Broadest addressable market. Lowest cost basis. |
| AI Vulnerability Scoring | ⚠️ Validate before build | Medium | Bear case: $1–2 pricing hard against ZoomInfo/Clearbit incumbents. Prompt logic exists from Mamba work but market fit needs more thought. |

Additional ecosystem gaps worth tracking for future Bulbs:
- Competitive intelligence + hiring signal tracking
- Intent data and buying signals
- These are additive, not immediate.

---

## Bulb 1 — Company Intelligence Brief

**Status:** Build first. This is the demo endpoint the launch video is built around.

### Input Schema (Zod)
```typescript
const CompanyIntelligenceInput = z.object({
  company: z.string().min(1).max(200).describe(
    "Company name or domain URL. Examples: 'Stripe', 'stripe.com', 'https://stripe.com'"
  ),
})
```

### Output Schema (Zod)
```typescript
const CompanyIntelligenceOutput = z.object({
  company: z.string(),
  summary: z.string().describe("2-3 sentence executive summary of current company state"),
  recent_news: z.array(z.object({
    headline: z.string(),
    date: z.string().nullable(),
    source: z.string().nullable(),
    significance: z.string().describe("Why this matters to someone evaluating this company"),
  })).max(5),
  hiring_signals: z.object({
    is_hiring: z.boolean(),
    growth_areas: z.array(z.string()),
    signal_strength: z.enum(["strong", "moderate", "weak", "none"]),
  }),
  leadership_changes: z.array(z.object({
    name: z.string().nullable(),
    role: z.string(),
    change_type: z.enum(["joined", "departed", "promoted"]),
    date: z.string().nullable(),
  })).max(3),
  funding_status: z.object({
    last_known_round: z.string().nullable(),
    estimated_stage: z.enum(["pre-seed", "seed", "series-a", "series-b", "series-c+", "public", "acquired", "unknown"]),
    signals: z.array(z.string()),
  }),
  confidence_score: z.number().min(0).max(1).describe(
    "0.0–1.0. Reflects data recency and source quality. Below 0.5 = warn the caller."
  ),
  data_freshness: z.object({
    oldest_source_days: z.number().nullable(),
    newest_source_days: z.number().nullable(),
  }),
})
```

### Pipeline
1. Exa `searchAndContents()` query: `"{company} news funding hiring leadership 2025 2026"`
   - `numResults: 8`
   - `type: "neural"`
   - `useAutoprompt: true`
   - `startPublishedDate`: 90 days ago (ISO string)
2. Claude synthesis with `tool_choice` enforcing `CompanyIntelligenceOutput` schema
3. Return structured JSON

### Pricing
- Testnet: Free (Base Sepolia devnet USDC)
- Mainnet: **$0.25 per call**
- Cost basis: ~$0.016–0.056 → margin of ~5–15x at $0.25

### MCP Tool Definition
```typescript
{
  name: "chandelier_company_intelligence",
  description: "Get a structured intelligence brief on any company: recent news, hiring signals, leadership changes, funding status. Powered by real-time web data. Costs $0.25 USDC per call via x402.",
  inputSchema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company name or domain. E.g. 'Stripe' or 'stripe.com'"
      }
    },
    required: ["company"]
  }
}
```

### LLM Usage Prompt
```
Use this endpoint when you need current intelligence on a company: recent news, whether they are hiring, leadership changes, or funding status. Input a company name or URL. Returns structured JSON. Costs $0.25 USDC per call. Do not call this for general knowledge about a company — only when you need recent, real-world signal.
```

### Sample Response (cache at `/v1/company-intelligence/sample`)
```json
{
  "company": "Stripe",
  "summary": "Stripe remains privately held and continues expanding its financial infrastructure suite, with recent focus on stablecoin payments and AI-native billing tools.",
  "recent_news": [
    {
      "headline": "Stripe launches stablecoin payment rails for emerging markets",
      "date": "2026-01-15",
      "source": "TechCrunch",
      "significance": "Signals direct competition with x402 and crypto-native payment infrastructure"
    }
  ],
  "hiring_signals": {
    "is_hiring": true,
    "growth_areas": ["AI infrastructure", "Stablecoin products", "Enterprise sales"],
    "signal_strength": "strong"
  },
  "leadership_changes": [],
  "funding_status": {
    "last_known_round": "Series I — $600M (2023)",
    "estimated_stage": "series-c+",
    "signals": ["No IPO announced", "Revenue reportedly $3B+ ARR"]
  },
  "confidence_score": 0.82,
  "data_freshness": {
    "oldest_source_days": 45,
    "newest_source_days": 3
  }
}
```

---

## Bulb 3 — Outbound Personalization

**Status:** Build second. Broadest market: sales tools, SDR agents, CRM enrichment pipelines.

> Note: Listed as "Bulb 3" in the reference doc but built second because it has better unit economics and broader immediate demand than Bulb 2.

### Input Schema (Zod)
```typescript
const OutboundPersonalizationInput = z.object({
  prospect_name: z.string().min(1).max(100).describe("Full name of the prospect"),
  company: z.string().min(1).max(200).describe("Company name or domain"),
  sender_context: z.string().max(500).optional().describe(
    "Optional: brief description of what the sender does / why they are reaching out. Helps tailor the message."
  ),
  output_type: z.enum(["opener_line", "email_opener", "full_first_paragraph"]).default("opener_line"),
})
```

### Output Schema (Zod)
```typescript
const OutboundPersonalizationOutput = z.object({
  prospect_name: z.string(),
  company: z.string(),
  personalized_opener: z.string().describe("The generated personalized opening line or paragraph"),
  suggested_subject: z.string().nullable().describe("Email subject line suggestion (null if output_type is opener_line)"),
  context_used: z.array(z.object({
    signal: z.string().describe("What was found"),
    source: z.string().nullable(),
    recency: z.string().nullable(),
  })).max(5).describe("The real-world signals that drove personalization"),
  confidence_score: z.number().min(0).max(1).describe(
    "0.0–1.0. How much real signal was found. Below 0.4 = generic output, warn caller."
  ),
  fallback_used: z.boolean().describe("True if personalization fell back to company-level data only"),
})
```

### Pipeline
1. Exa `searchAndContents()` — two queries in parallel:
   - `"{prospect_name} {company}"` — individual signal
   - `"{company} news 2025 2026"` — company context
   - `numResults: 5` each, `type: "neural"`, `startPublishedDate`: 60 days ago
2. Merge results, deduplicate
3. Claude synthesis with `tool_choice` enforcing `OutboundPersonalizationOutput` schema
4. Return structured JSON

### Pricing
- Testnet: Free
- Mainnet: **$0.15 per call**
- Cost basis: ~$0.016–0.056 → margin at $0.15 is thinner but volume compensates

### MCP Tool Definition
```typescript
{
  name: "chandelier_outbound_personalization",
  description: "Generate a hyper-personalized outbound email opener for a specific prospect at a specific company. Uses real-time web research to find recent signals about the person and company. Costs $0.15 USDC per call via x402.",
  inputSchema: {
    type: "object",
    properties: {
      prospect_name: { type: "string", description: "Full name of the prospect" },
      company: { type: "string", description: "Company name or domain" },
      sender_context: { type: "string", description: "Optional: what you do and why you're reaching out" },
      output_type: {
        type: "string",
        enum: ["opener_line", "email_opener", "full_first_paragraph"],
        default: "opener_line"
      }
    },
    required: ["prospect_name", "company"]
  }
}
```

### LLM Usage Prompt
```
Use this endpoint when you need to write a personalized cold outreach message to a specific person. Input their name, company, and optionally what you're selling. Returns a personalized opener based on real current signals (recent news, job changes, company activity). Costs $0.15 USDC per call. Do not use for bulk generic outreach — this is designed for signal-driven personalization.
```

---

## Bulb 2 — AI Vulnerability Scoring

**Status:** ⚠️ Under validation. Do NOT build yet.

### Why it is not built first

The prompt logic exists from prior Mamba work, and the output schema is well-defined. However, the pricing model has a known problem: at $1–2 per call, Chandelier is competing with ZoomInfo, Clearbit, Apollo, and VC-backed intelligence vendors that have years of proprietary data and enterprise contracts. The x402 ecosystem is anchoring at $0.01–$0.10 for most endpoints.

The counterargument is that Bulb 2 is genuinely a different product category (AI disruption risk scoring, not company data enrichment) and has no direct x402 analogue today. This needs validation before building — specifically: is there evidence that agent workflows would autonomously purchase $1–2 intelligence per call, or is this always a human-initiated premium decision?

### What needs to be true before building

1. At least one concrete agent workflow use case where $1–2 per call makes economic sense
2. Confidence that the Mamba prompt logic produces defensibly differentiated output vs. GPT-4 doing the same thing free
3. Decision on whether to price at $0.25 (competitive with Bulb 1) or hold at $1–2 (premium signal)

### Spec (when ready to build)

Input: `company` (name or URL)

Output:
```typescript
z.object({
  company: z.string(),
  ai_vulnerability_score: z.number().min(0).max(10),
  risk_level: z.enum(["critical", "high", "moderate", "low", "minimal"]),
  reasoning: z.string().describe("2-3 sentence explanation of the score"),
  key_vulnerabilities: z.array(z.object({
    area: z.string(),
    description: z.string(),
    severity: z.enum(["high", "medium", "low"]),
  })).max(5),
  moat_assessment: z.object({
    strengths: z.array(z.string()).max(3),
    weaknesses: z.array(z.string()).max(3),
  }),
  confidence_score: z.number().min(0).max(1),
})
```

Price: $1.00–2.00 (pending validation)

---

## Future Bulbs — Tracked, Not Scheduled

These map to the ecosystem gaps identified in the reference doc. Log them here as they solidify.

### Competitive Intelligence + Hiring Signal Tracker
- Input: Company name → Output: competitor landscape, open roles as growth signals, tech stack signals
- Why interesting: combines two high-value signals in one call; agents in sales/recruiting workflows would use this frequently
- Status: Concept only

### Intent Data + Buying Signal Scorer
- Input: Company name → Output: signals that suggest active purchasing behaviour (job postings for relevant roles, tech stack changes, leadership hires in relevant areas)
- Why interesting: closest thing to intent data without a proprietary database
- Status: Concept only

---

## Bulb Naming Convention

Route: `/v1/{bulb-name}` — lowercase, hyphenated
Examples:
- `/v1/company-intelligence`
- `/v1/outbound-personalization`
- `/v1/ai-vulnerability` (when built)

Manifest entry uses `bulb_id` matching the route slug.
