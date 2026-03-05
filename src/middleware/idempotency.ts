import { Request, Response, NextFunction } from 'express'

interface CacheEntry {
  response: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 5 * 60 * 1000 // 5 minutes

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

// IMPORTANT: Mount this middleware BEFORE x402 payment middleware.
// If a cache hit is found, the response is returned before payment is attempted,
// preventing double-charges on retried requests with the same Idempotency-Key.
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.headers['idempotency-key']
  if (key && typeof key === 'string') {
    const cached = getCached(key)
    if (cached) {
      res.status(200).json(cached)
      return
    }
    res.locals['idempotencyKey'] = key
  }
  next()
}
