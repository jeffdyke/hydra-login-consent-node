/**
 * Functional login route using Effect
 */
import { Effect, pipe } from 'effect'
import express from 'express'
import { type AppError } from '../fp/errors.js'
import { processLogin } from '../fp/services/login.js'
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
 * Login handler factory
 */
const createLoginHandler = (serviceLayer: Layer.Layer<HydraService | Logger>) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const challenge = String(req.query.login_challenge ?? req.body.challenge)

    if (!challenge) {
      next(new Error('Expected a login challenge to be set but received none.'))
      return
    }

    const program = pipe(
      processLogin(challenge, SUBJECT_PLACEHOLDER),
      Effect.provide(serviceLayer)
    )

    const result = await Effect.runPromise(Effect.either(program))

    if (result._tag === 'Left') {
      const { status, message } = mapErrorToHttp(result.left)
      res.status(status).send(message)
    } else {
      res.redirect(result.right)
    }
  }
}

/**
 * Create login router with service layer
 */
export const createLoginRouter = (serviceLayer: Layer.Layer<HydraService | Logger>) => {
  const handler = createLoginHandler(serviceLayer)

  router.get('/', handler)
  router.post('/', handler)

  return router
}

export default router
