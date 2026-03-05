import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { HTTPFacilitatorClient } from '@x402/core/server'
import type { UnpaidResponseBody } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import type { Network } from '@x402/core/types'

// Per CLAUDE.md Law #7 — 402 must include top_up_url, amount, currency, network
function unpaidBody(amountUsdc: string): UnpaidResponseBody {
  return () => ({
    contentType: 'application/json',
    body: {
      error: 'payment_required',
      message: 'This endpoint requires a USDC micropayment via x402',
      top_up_url: 'https://chandelier.dev/top-up',
      amount_required: amountUsdc,
      currency: 'USDC',
      network: process.env['NETWORK'],
    },
  })
}

// Map our NETWORK env var to EIP-155 chain IDs
const NETWORK_MAP: Record<string, Network> = {
  'base': 'eip155:8453' as Network,
  'base-sepolia': 'eip155:84532' as Network,
}

export function createPaymentMiddleware() {
  const network = process.env['NETWORK']!
  const chainId = NETWORK_MAP[network]
  if (!chainId) {
    throw new Error(`Unknown network: ${network}`)
  }

  const facilitator = new HTTPFacilitatorClient({
    url: process.env['PAYMENT_FACILITATOR_URL']!,
  })

  const resourceServer = new x402ResourceServer(facilitator).register(
    chainId,
    new ExactEvmScheme()
  )

  return paymentMiddleware(
    {
      // Route key includes HTTP method — only POST is gated, GET /schema and /sample are free
      'POST /v1/company-intelligence': {
        accepts: {
          scheme: 'exact',
          price: '$0.25',
          network: chainId,
          payTo: process.env['PAYMENT_ADDRESS']!,
        },
        description: 'Company Intelligence Brief — structured intel on any company',
        unpaidResponseBody: unpaidBody('0.25'),
      },
      // Add new Bulbs here as they ship
    },
    resourceServer
  )
}
