/**
 * E2E Payment Test — Chandelier Bulb 1
 *
 * Runs a full x402 payment flow against the local server:
 *   1. POST /v1/company-intelligence → 402 (no payment)
 *   2. Parse payment requirements from 402 response
 *   3. Sign payment with test wallet
 *   4. Retry with X-PAYMENT header → 200 + intelligence
 *
 * Usage:
 *   TEST_WALLET_PRIVATE_KEY=0x... npx tsx scripts/test-payment.ts
 *
 * Prerequisites:
 *   - Server running: npm run dev (in another terminal)
 *   - Test wallet funded with Base Sepolia USDC and ETH
 */

import 'dotenv/config'
import { createWalletClient, http, publicActions, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { registerExactEvmScheme } from '@x402/evm/exact/client'

const SERVER_URL = 'http://localhost:3000'
const BULB_URL = `${SERVER_URL}/v1/company-intelligence`
const TEST_COMPANY = 'Anthropic'

const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
})

async function run() {
  // --- Wallet setup ---
  const rawKey = process.env['TEST_WALLET_PRIVATE_KEY']
  if (!rawKey) {
    throw new Error('TEST_WALLET_PRIVATE_KEY is not set')
  }

  // Normalise — MetaMask sometimes exports without the 0x prefix
  const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`
  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  }).extend(publicActions)

  // ClientEvmSigner requires address at the top level — viem puts it at account.address
  const signer = Object.assign(walletClient, { address: account.address })

  console.log(`\nTest wallet: ${account.address}`)

  // --- x402 client setup ---
  const client = new x402Client()
  registerExactEvmScheme(client, { signer })
  const httpClient = new x402HTTPClient(client)

  // --- Step 1: Hit endpoint without payment (expect 402) ---
  console.log(`\n[1] POST ${BULB_URL} (no payment)...`)
  const firstResponse = await fetch(BULB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company: TEST_COMPANY }),
  })

  if (firstResponse.status !== 402) {
    throw new Error(`Expected 402, got ${firstResponse.status}`)
  }

  const unpaidBody = await firstResponse.json()
  console.log(`    ✓ Got 402 — ${JSON.stringify(unpaidBody)}`)

  // --- Step 2: Parse payment requirements from 402 ---
  console.log('\n[2] Parsing payment requirements...')
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => firstResponse.headers.get(name),
    unpaidBody
  )
  console.log(`    ✓ Payment required: ${JSON.stringify(paymentRequired)}`)

  // --- Step 3: Sign payment ---
  console.log('\n[3] Signing payment...')
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired)
  const paymentHeader = httpClient.encodePaymentSignatureHeader(paymentPayload)
  console.log(`    ✓ Payment signed`)

  // --- Step 4: Retry with payment header ---
  console.log(`\n[4] POST ${BULB_URL} (with payment)...`)
  const paidStart = Date.now()
  const paidResponse = await fetch(BULB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...paymentHeader,
    },
    body: JSON.stringify({ company: TEST_COMPANY }),
  })

  const latencyMs = Date.now() - paidStart

  if (!paidResponse.ok) {
    const err = await paidResponse.text()
    console.log('    Response headers:')
    paidResponse.headers.forEach((v, k) => console.log(`      ${k}: ${v}`))
    throw new Error(`Payment failed — ${paidResponse.status}: ${err}`)
  }

  // --- Results ---
  const intelligence = await paidResponse.json()
  const cost = paidResponse.headers.get('X-Chandelier-Cost')
  const latencyHeader = paidResponse.headers.get('X-Chandelier-Latency')

  console.log(`    ✓ Got 200 in ${latencyMs}ms`)
  console.log(`    ✓ X-Chandelier-Cost: ${cost} USDC`)
  console.log(`    ✓ X-Chandelier-Latency: ${latencyHeader}`)
  console.log('\n--- Intelligence output ---')
  console.log(JSON.stringify(intelligence, null, 2))
  console.log('\n✅ E2E payment test passed\n')
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err.message)
  process.exit(1)
})
