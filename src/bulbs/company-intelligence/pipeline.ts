import { searchAndContents, type ExaResult } from '../../lib/exa.js'
import { synthesizeStructured } from '../../lib/claude.js'
import { log } from '../../lib/logger.js'
import { SYSTEM_PROMPT } from './prompt.js'
import {
  CompanyIntelligenceOutput,
  type CompanyIntelligenceOutputType,
} from './schema.js'

const STRICT_SUFFIX =
  '\n\nSTRICT MODE: Every required field must be populated. Use null for unavailable nullable fields. Use empty arrays for unavailable array fields. Do not omit any field.'

interface PipelineResult {
  result: CompanyIntelligenceOutputType
  exaMs: number
  claudeMs: number
}

export async function runPipeline(
  company: string,
  idempotencyKey?: string
): Promise<PipelineResult> {
  // --- Exa search ---
  const exaStart = Date.now()

  const since = new Date()
  since.setDate(since.getDate() - 90)
  const startPublishedDate = since.toISOString().split('T')[0]!

  const results = await searchAndContents({
    query: `"${company}" news funding hiring leadership 2025 2026`,
    numResults: 8,
    startPublishedDate,
    useAutoprompt: true,
  })

  const exaMs = Date.now() - exaStart
  log({
    event: 'exa_complete',
    bulb: 'company-intelligence',
    exa_ms: exaMs,
    result_count: results.length,
    idempotency_key: idempotencyKey,
  })

  // --- Claude synthesis ---
  const userContent = formatForClaude(company, results)
  const claudeStart = Date.now()

  const callClaude = (systemPrompt: string) =>
    synthesizeStructured({
      systemPrompt,
      userContent,
      outputSchema: CompanyIntelligenceOutput,
      toolName: 'structured_output',
      toolDescription: 'Output the structured company intelligence brief',
    })

  let result: CompanyIntelligenceOutputType
  try {
    result = await callClaude(SYSTEM_PROMPT)
  } catch {
    // Retry once with stricter prompt before giving up
    try {
      result = await callClaude(SYSTEM_PROMPT + STRICT_SUFFIX)
    } catch (retryErr) {
      throw new Error(
        `SYNTHESIS_FAILED: ${(retryErr as Error).message}`
      )
    }
  }

  const claudeMs = Date.now() - claudeStart
  log({
    event: 'claude_complete',
    bulb: 'company-intelligence',
    claude_ms: claudeMs,
    idempotency_key: idempotencyKey,
  })

  return { result, exaMs, claudeMs }
}

function formatForClaude(company: string, results: ExaResult[]): string {
  const sources = results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}
URL: ${r.url}
Published: ${r.publishedDate ?? 'unknown'}
Content: ${r.text ?? 'No content available'}`
    )
    .join('\n\n---\n\n')

  return `Compile a structured intelligence brief for: ${company}

Search results (${results.length} sources):

${sources}`
}
