/**
 * Functional index route using Effect
 */
import { Effect, pipe } from 'effect'
import express from 'express'
import { type AppError } from '../fp/errors.js'
import type { HydraService } from '../fp/services/hydra.js'
import type { Logger } from '../fp/services/token.js'
import type { Layer } from 'effect';

const router = express.Router()
const SUBJECT_PLACEHOLDER = 'claude@claude.ai'

/**
 * Map application errors to HTTP responses
 */
const mapErrorToHttp = (error: AppError): { status: number; message: string } => {
  switch (error._tag) {
    case 'HttpStatusError':
      return { status: error.status, message: error.statusText }
    case 'NetworkError':
      return { status: 500, message: 'Network error communicating with Hydra' }
    default:
      return { status: 500, message: 'Internal server error' }
  }
}

/**
 * index handler factory
 */
const indexHandler = (serviceLayer: Layer.Layer<HydraService | Logger>) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return res.status(200).json("oh yeah")

  }
}

/**
 * Create index router with service layer
 */
export const createIndexRouter = (serviceLayer: Layer.Layer<HydraService | Logger>) => {
  const handler = indexHandler(serviceLayer)

  router.get('/', handler)
  router.post('/', handler)

  return router
}

export default router
