import Exa from 'exa-js'

const exa = new Exa(process.env['EXA_API_KEY']!)

const EXA_TIMEOUT_MS = 3000

export interface ExaSearchOptions {
  query: string
  numResults?: number
  startPublishedDate?: string // ISO date string e.g. "2025-12-01"
  useAutoprompt?: boolean
}

export interface ExaResult {
  url: string
  title: string
  text?: string
  publishedDate?: string
  score?: number
}

export async function searchAndContents(
  options: ExaSearchOptions
): Promise<ExaResult[]> {
  const {
    query,
    numResults = 8,
    startPublishedDate,
    useAutoprompt = true,
  } = options

  const searchPromise = exa.searchAndContents(query, {
    type: 'auto',
    numResults,
    useAutoprompt,
    startPublishedDate,
    text: {
      maxCharacters: 2000,
    },
  })

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('EXA_TIMEOUT')), EXA_TIMEOUT_MS)
  )

  const result = await Promise.race([searchPromise, timeoutPromise])

  return result.results.map((r) => ({
    url: r.url,
    title: r.title ?? '',
    text: r.text ?? undefined,
    publishedDate: r.publishedDate ?? undefined,
    score: r.score ?? undefined,
  }))
}
