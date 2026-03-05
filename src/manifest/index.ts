import { Router, Request, Response } from 'express'

export const manifestRouter = Router()

manifestRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    network: process.env['NETWORK'],
    health: 'ok',
    bulbs: [
      {
        bulb_id: 'company-intelligence',
        name: 'Company Intelligence Brief',
        description:
          'Structured intelligence brief on any company: recent news, hiring signals, leadership changes, funding status.',
        endpoint: '/v1/company-intelligence',
        price_usdc: '0.25',
        schema_url: '/v1/company-intelligence/schema',
        sample_url: '/v1/company-intelligence/sample',
        status: 'active',
        llm_usage_prompt:
          'Use this endpoint when you need current intelligence on a company: recent news, whether they are hiring, leadership changes, or funding status. Input a company name or URL. Returns structured JSON. Costs $0.25 USDC per call. Do not call this for general knowledge about a company — only when you need recent, real-world signal.',
      },
    ],
    payment: {
      protocol: 'x402',
      network: process.env['NETWORK'],
      currency: 'USDC',
      facilitator: process.env['PAYMENT_FACILITATOR_URL'],
    },
  })
})
