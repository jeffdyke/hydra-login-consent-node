/**
 * Functional Google OAuth callback route using Effect
 */
import { Effect, pipe } from 'effect'
import express from 'express'
import { type AppError } from '../fp/errors.js'
import { processCallback, type GoogleOAuthClient, type CallbackConfig } from '../fp/services/callback.js'
import type { RedisService } from '../fp/services/redis.js'
import type { Logger } from '../fp/services/token.js'
import type { Layer } from 'effect';

const router = express.Router()

/**
 * Map application errors to HTTP responses
 */
const mapErrorToHttp = (error: AppError): { status: number; message: string } => {
  switch (error._tag) {
    case 'GoogleAuthError':
      return {
        status: 400,
        message: `Google token exchange failed: ${error.errorDescription}`,
      }
    case 'RedisKeyNotFound':
      return { status: 400, message: 'Session not found or expired' }
    case 'RedisParseError':
      return { status: 500, message: 'Session data corrupted' }
    default:
      return { status: 500, message: 'Internal server error' }
  }
}

/**
 * Callback handler
 */
const createCallbackHandler = (
  serviceLayer: Layer.Layer<RedisService | Logger>,
  googleClient: GoogleOAuthClient,
  config: CallbackConfig
) => {
  return async (req: express.Request, res: express.Response) => {
    const code = req.query.code as string
    const returnedState = req.query.state as string
    const pkceKey = req.session?.pkceKey as string | undefined

    if (!code) {
      res.status(400).send('Missing authorization code')
      return
    }

    if (!req.session || !pkceKey) {
      res.status(400).send('Missing session or PKCE key')
      return
    }

    const program = pipe(
      processCallback(code, returnedState, pkceKey, googleClient, config),
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
 * Create callback router with service layer
 */
export const createCallbackRouter = (
  serviceLayer: Layer.Layer<RedisService | Logger>,
  googleClient: GoogleOAuthClient,
  config: CallbackConfig
) => {
  router.get('/', createCallbackHandler(serviceLayer, googleClient, config))
  return router
}

export default router
