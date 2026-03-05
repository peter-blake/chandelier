import { Router, Request, Response } from 'express'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { log } from '../../lib/logger.js'
import { setCached } from '../../middleware/idempotency.js'
import { runPipeline } from './pipeline.js'
import {
  CompanyIntelligenceInput,
  CompanyIntelligenceOutput,
} from './schema.js'
import sample from './sample.json' with { type: 'json' }

export const companyIntelligenceRouter = Router()

// POST /v1/company-intelligence — paid, x402 gated
companyIntelligenceRouter.post('/', async (req: Request, res: Response) => {
  const totalStart = Date.now()
  const idempotencyKey = res.locals['idempotencyKey'] as string | undefined

  const parsed = CompanyIntelligenceInput.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_input',
      message: 'Request body failed schema validation',
      details: parsed.error.errors,
    })
    return
  }

  log({
    event: 'payment_verified',
    bulb: 'company-intelligence',
    idempotency_key: idempotencyKey,
  })

  try {
    const { result, exaMs, claudeMs } = await runPipeline(
      parsed.data.company,
      idempotencyKey
    )
    const totalMs = Date.now() - totalStart

    if (idempotencyKey) {
      setCached(idempotencyKey, result)
    }

    log({
      event: 'response_delivered',
      bulb: 'company-intelligence',
      total_ms: totalMs,
      usdc_charged: '0.25',
      idempotency_key: idempotencyKey,
    })

    res.set('X-Chandelier-Bulb', 'active')
    res.set('X-Chandelier-Cost', '0.25')
    res.set(
      'X-Chandelier-Latency',
      JSON.stringify({ exa_ms: exaMs, claude_ms: claudeMs, total_ms: totalMs })
    )
    res.status(200).json(result)
  } catch (err) {
    const error = err as Error

    log({
      event: 'dead_letter',
      bulb: 'company-intelligence',
      error: error.message,
      idempotency_key: idempotencyKey,
    })

    if (error.message === 'EXA_TIMEOUT') {
      res.status(503).json({
        error: 'upstream_unavailable',
        message: 'Retrieval service temporarily unavailable',
        retry_after: 5,
        charged: false,
      })
      return
    }

    if (error.message.startsWith('SYNTHESIS_FAILED')) {
      res.status(422).json({
        error: 'synthesis_failed',
        message: 'Unable to generate structured output after retry',
        charged: false,
      })
      return
    }

    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    })
  }
})

// GET /v1/company-intelligence/schema — free
companyIntelligenceRouter.get('/schema', (_req: Request, res: Response) => {
  res.json({
    bulb: 'company-intelligence',
    input: zodToJsonSchema(CompanyIntelligenceInput, { target: 'openApi3' }),
    output: zodToJsonSchema(CompanyIntelligenceOutput, { target: 'openApi3' }),
  })
})

// GET /v1/company-intelligence/sample — free
companyIntelligenceRouter.get('/sample', (_req: Request, res: Response) => {
  res.json(sample)
})
