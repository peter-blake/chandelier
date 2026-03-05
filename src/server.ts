import 'dotenv/config'
import { validateEnv } from './config/env.js'

// Validate all required environment variables before anything else.
// Server throws and exits here if any are missing or invalid.
validateEnv()

import express, { Request, Response } from 'express'
import { idempotencyMiddleware } from './middleware/idempotency.js'
import { createPaymentMiddleware } from './middleware/x402.js'
import { manifestRouter } from './manifest/index.js'
import { bulbRouter } from './bulbs/index.js'

const app = express()
const PORT = process.env['PORT'] ?? 3000

app.use(express.json())

// Free endpoints — no payment, no idempotency needed
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', network: process.env['NETWORK'] })
})

app.use('/manifest', manifestRouter)

// Paid routes: idempotency MUST come before x402 (prevents double-charging on retries)
app.use('/v1', idempotencyMiddleware)
app.use('/v1', createPaymentMiddleware())
app.use('/v1', bulbRouter)

app.listen(PORT, () => {
  process.stdout.write(
    JSON.stringify({
      event: 'server_start',
      port: PORT,
      network: process.env['NETWORK'],
      ts: new Date().toISOString(),
    }) + '\n'
  )
})
