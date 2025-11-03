/**
 * Functional consent route using Effect
 */
import express from 'express'
import { Effect, pipe, Layer } from 'effect'
import { type AppError } from '../fp/errors.js'
import { processConsent, type ConsentConfig } from '../fp/services/consent.js'
import { HydraService } from '../fp/services/hydra.js'
import { Logger } from '../fp/services/token.js'

const router = express.Router()

/**
 * Map application errors to HTTP responses
 */
const mapErrorToHttp = (error: AppError): { status: number; message: string } => {
  switch (error._tag) {
    case 'HttpStatusError':
      return { status: error.status, message: error.statusText }
    case 'NetworkError':
      return { status: 500, message: 'Network error communicating with Hydra' }
    case 'RedisKeyNotFound':
      return { status: 400, message: 'Session not found or expired' }
    default:
      return { status: 500, message: 'Internal server error' }
  }
}

/**
 * Consent handler
 */
const createConsentHandler = (
  serviceLayer: Layer.Layer<HydraService | Logger>,
  config: ConsentConfig
) => {
  return async (req: express.Request, res: express.Response) => {
    const challenge = String(req.query.consent_challenge)
    const requestedScope = req.query.requested_scope as string | undefined

    if (!challenge) {
      res.status(400).send('Missing consent_challenge parameter')
      return
    }

    const program = pipe(
      processConsent(challenge, config, requestedScope),
      Effect.provide(serviceLayer)
    )

    const result = await Effect.runPromise(Effect.either(program))

    if (result._tag === 'Left') {
      const { status, message } = mapErrorToHttp(result.left)
      res.status(status).render('error', { message })
    } else {
      res.redirect(result.right)
    }
  }
}

/**
 * Create consent router with service layer
 */
export const createConsentRouter = (
  serviceLayer: Layer.Layer<HydraService | Logger>,
  config: ConsentConfig
) => {
  router.get('/', createConsentHandler(serviceLayer, config))
  return router
}

export default router
