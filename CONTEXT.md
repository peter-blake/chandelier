# Chandelier — Project Context

This file gives Claude Code the background reasoning behind decisions. Read this to understand *why* things are built the way they are — not just what to build.

---

## Project Background

Chandelier was conceived as an answer to a gap in the x402 ecosystem as of March 2026. The ecosystem (251+ endpoints on Coinbase Bazaar) clusters heavily around AI inference wrappers, web scraping, and crypto/DeFi data. High-value B2B intelligence categories — company enrichment, sales personalization, competitive intelligence — are either absent or poorly served.

The insight: these are exactly the categories AI agents in sales, research, and strategic workflows need most. And they're categories where $0.25–1.00 per call is genuinely cheap compared to incumbent pricing (ZoomInfo, Clearbit, Apollo charge $0.50–5.00+ per enrichment at scale).

**The Mamba connection:** Prior work building AI-powered sales intelligence tools at Mamba provided the prompt engineering foundation, particularly for vulnerability scoring and outbound personalization. Chandelier is the API-native, agent-first version of that work.

---

## Why x402

x402 revives HTTP 402 as a native internet payment layer. No accounts, no subscriptions, no API keys required for callers — just a wallet and USDC. This makes Chandelier usable by autonomous agents without human intervention in the payment flow.

The protocol is 10 months old (launched May 2025 by Coinbase). This is early. That is intentional — being 12–18 months early in infrastructure plays is better than 6 months late.

Key constraint: **x402 is the only payment mechanism.** No Stripe, no credit cards, no API key credits system. This is a philosophical choice to stay native to the agent economy.

---

## Why Exa + Claude (Not Other Retrieval + LLMs)

**Exa:** `searchAndContents()` returns semantically-retrieved web content with full text in a single API call. This is the only retrieval API that makes the Bulb pipeline economically viable — competitors require multiple calls or produce significantly lower quality neural search. Exa is also a strategic partner for distribution amplification.

**Claude:** Structured output via `tool_choice` enforcement is the most reliable mechanism for guaranteed JSON output with zero parsing errors. Claude also has the lowest hallucination rate on factual synthesis tasks among commercially available models. The `@anthropic-ai/sdk` structured output pattern is battle-tested.

Using `claude-sonnet-4-6` as the default model. Do not use Opus (cost prohibitive per call) or Haiku (quality insufficient for intelligence synthesis).

---

## Brand Rules (Relevant to Code)

- Product name: **Chandelier**
- Individual endpoints: **Bulbs** (always capitalised in docs/comments, lowercase in routes)
- Tagline: *Agentic payments are coming. Start here.*
- Open source: The **scaffold** (this repo) is open source. The specific Bulb implementations (prompts, schemas, post-processing) are proprietary to the Chandelier brand.

**Mascot context** (relevant if generating demo content): A hyper-realistic lobster + a small unnamed French-looking character. These appear in video content, not in code. Never name the French character — it visually evokes Claude without trademark exposure.

---

## What Is Open Source vs. Proprietary

| Open Source (this repo) | Proprietary (Chandelier brand) |
|------------------------|-------------------------------|
| Express + x402 scaffold | Specific Bulb implementations |
| Exa wrapper pattern | Claude prompts per Bulb |
| Claude structured output pattern | Output schemas |
| MCP server template | Video production system |
| Bazaar/llms.txt template | The Chandelier landing page |

The open source strategy is the distribution engine. Developers build their own Bulbs on the scaffold. They discover Chandelier. The brand endpoints are what they pay for.

---

## Distribution Priority Order

1. **MCP Server** — highest leverage. Claude Code, Cursor, Windsurf users get Chandelier tools inline. 97M+ monthly MCP SDK downloads is ambient traffic.
2. **Coinbase Bazaar** — AEO metadata registration for autonomous agent discovery.
3. **Twitter + demo video** — human launch moment. Only after a working curl command exists.
4. **AgentPay Discord (~42K members)** — largest x402-specific community.
5. **awesome-x402 list submission** — curation signal.
6. **CDP Builder Grants** — $30K+ per cohort. Apply once Bulb 1 is live.

**Do not engage Twitter before there is a working endpoint.** The x402 community is small and high-signal. Demonstrate, don't announce.

---

## Key Ecosystem Players (Context for Any Outreach/Docs Content)

| Person/Entity | Role | Why Relevant |
|---------------|------|-------------|
| @programmer (Erik Reppel) | x402 co-author, Head of Engineering CDP | Most important technical relationship in ecosystem |
| @kleffew94 (Kevin Leffew) | CDP GTM | Key amplifier for launch |
| @ExaAILabs | Exa — core infrastructure partner | Mutual amplification opportunity |
| Rug Munch Intelligence | Closest comparable: 19 endpoints, Claude Opus-powered, $0.02–2.00 | Benchmark for quality and pricing |
| Apollo Intelligence Network | 27 x402 endpoints | Benchmark for breadth |

---

## Open Questions (Do Not Block Build On These)

These are unresolved decisions. Note them, but do not let them block building Bulb 1.

1. **Bulb 2 validation** — AI Vulnerability Scoring pricing at $1–2 needs market validation before build. See BULBS.md.
2. **Landing page gamification** — how does Bulb brightness actually work? Real-time tx counter? Daily resets? TBD.
3. **Music gen tooling** — which AI music tool for demo videos? Not a code concern.
4. **CDP Builder Grant timing** — next cohort dates. Check cdp.coinbase.com after Bulb 1 ships.
5. **Co-founder question** — solo vs. with James. Not a code concern, but affects workload sequencing.
6. **Vin integration** — OpenClaw agent (WhatsApp/Discord, Mac Mini) for video performance tracking. Separate system, not part of this repo.

---

## Comparable Projects to Study

- **exa-labs/company-researcher** — Exa + Claude research pipeline reference implementation
- **thirdweb-example/x402-ai-inference** — Dynamic pricing scheme example for x402
- **coinbase/x402** — Official SDK and examples

---

## Cost Model (For Pricing Decisions)

| Component | Cost per call |
|-----------|--------------|
| Exa `searchAndContents()` | ~$0.006 |
| Claude synthesis (variable) | ~$0.01–0.05 |
| **Total cost basis** | **~$0.016–0.056** |
| CDP facilitator (1K free/month) | $0 (free tier) then $0.001/tx |

Target 5–10x markup:
- Bulb 1 (Company Intelligence): **$0.25** → ~6–15x margin
- Bulb 3 (Outbound Personalization): **$0.15** → ~3–9x margin
- Bulb 2 (AI Vulnerability — pending): **$1.00–2.00** → ~20–60x margin

Do not change pricing without updating both `BULBS.md` and the x402 middleware config simultaneously.
