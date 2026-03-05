// NOTE: Verify the paymentMiddleware signature against the current @x402/express package
// before deploying. The package was at v0.x as of early 2026 — API surface may have evolved.
// Reference: https://github.com/coinbase/x402
import { paymentMiddleware } from '@x402/express'

export function createPaymentMiddleware() {
  return paymentMiddleware(
    process.env['PAYMENT_ADDRESS']!,
    {
      '/v1/company-intelligence': '$0.25',
      // Add new Bulbs here as they ship
    },
    {
      facilitatorUrl: process.env['PAYMENT_FACILITATOR_URL']!,
      network: process.env['NETWORK'] as 'base' | 'base-sepolia',
    }
  )
}
