import { Router } from 'express'
import { companyIntelligenceRouter } from './company-intelligence/index.js'

export const bulbRouter = Router()

bulbRouter.use('/company-intelligence', companyIntelligenceRouter)
