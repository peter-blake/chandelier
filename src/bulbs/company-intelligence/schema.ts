import { z } from 'zod'

export const CompanyIntelligenceInput = z.object({
  company: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "Company name or domain URL. Examples: 'Stripe', 'stripe.com', 'https://stripe.com'"
    ),
})

export const CompanyIntelligenceOutput = z.object({
  company: z.string(),
  summary: z
    .string()
    .describe('2-3 sentence executive summary of current company state'),
  recent_news: z
    .array(
      z.object({
        headline: z.string(),
        date: z.string().nullable(),
        source: z.string().nullable(),
        significance: z
          .string()
          .describe('Why this matters to someone evaluating this company'),
      })
    )
    .max(5),
  hiring_signals: z.object({
    is_hiring: z.boolean(),
    growth_areas: z.array(z.string()),
    signal_strength: z.enum(['strong', 'moderate', 'weak', 'none']),
  }),
  leadership_changes: z
    .array(
      z.object({
        name: z.string().nullable(),
        role: z.string(),
        change_type: z.enum(['joined', 'departed', 'promoted']),
        date: z.string().nullable(),
      })
    )
    .max(3),
  funding_status: z.object({
    last_known_round: z.string().nullable(),
    estimated_stage: z.enum([
      'pre-seed',
      'seed',
      'series-a',
      'series-b',
      'series-c+',
      'public',
      'acquired',
      'unknown',
    ]),
    signals: z.array(z.string()),
  }),
  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      '0.0–1.0. Reflects data recency and source quality. Below 0.5 = warn the caller.'
    ),
  data_freshness: z.object({
    oldest_source_days: z.number().nullable(),
    newest_source_days: z.number().nullable(),
  }),
})

export type CompanyIntelligenceInputType = z.infer<
  typeof CompanyIntelligenceInput
>
export type CompanyIntelligenceOutputType = z.infer<
  typeof CompanyIntelligenceOutput
>
