const REQUIRED_VARS = [
  'EXA_API_KEY',
  'ANTHROPIC_API_KEY',
  'CDP_API_KEY_NAME',
  'CDP_API_KEY_PRIVATE_KEY',
  'PAYMENT_FACILITATOR_URL',
  'PAYMENT_ADDRESS',
  'NETWORK',
] as const

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\nCheck your .env file against .env.example.`
    )
  }

  const network = process.env['NETWORK']
  if (network !== 'base' && network !== 'base-sepolia') {
    throw new Error(
      `NETWORK must be "base" or "base-sepolia", got: "${network}"`
    )
  }
}
