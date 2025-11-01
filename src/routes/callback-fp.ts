/**
 * Functional Google OAuth callback route using fp-ts
 */
import express from 'express'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import { OAuth2Client } from 'google-auth-library'
import { AppEnvironment } from '../fp/environment.js'
import { AppError } from '../fp/errors.js'
import { processCallback } from '../fp/services/callback.js'

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
const createCallbackHandler = (env: AppEnvironment, googleClient: OAuth2Client) => {
  return async (req: express.Request, res: express.Response) => {
    const code = req.query.code as string
    const returnedState = req.query.state as string
    const pkceKey = req.session?.pkceKey as string | undefined

    if (!code) {
      env.logger.error('Missing authorization code in callback')
      res.status(400).send('Missing authorization code')
      return
    }

    if (!req.session || !pkceKey) {
      env.logger.error('Missing session or PKCE key', {
        hasSession: !!req.session,
        pkceKey,
      })
      res.status(400).send('Missing session or PKCE key')
      return
    }

    const result = await processCallback(
      code,
      returnedState,
      pkceKey,
      googleClient
    )(env)()

    pipe(
      result,
      E.fold(
        (error) => {
          const { status, message } = mapErrorToHttp(error)
          env.logger.error('Callback failed', { error, status, message })
          res.status(status).send(message)
        },
        (redirectUrl) => {
          res.redirect(redirectUrl)
        }
      )
    )
  }
}

/**
 * Create callback router with environment
 */
export const createCallbackRouter = (
  env: AppEnvironment,
  googleClient: OAuth2Client
) => {
  router.get('/', createCallbackHandler(env, googleClient))
  return router
}

export default router
