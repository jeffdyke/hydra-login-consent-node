/**
 * Functional consent route using fp-ts
 */
import express from 'express'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import { AppEnvironment } from '../fp/environment.js'
import { AppError } from '../fp/errors.js'
import { processConsent } from '../fp/services/consent.js'

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
const createConsentHandler = (env: AppEnvironment) => {
  return async (req: express.Request, res: express.Response) => {
    const challenge = String(req.query.consent_challenge)
    const requestedScope = req.query.requested_scope as string | undefined

    if (!challenge) {
      res.status(400).send('Missing consent_challenge parameter')
      return
    }

    const result = await processConsent(challenge, requestedScope)(env)()

    pipe(
      result,
      E.fold(
        (error) => {
          const { status, message } = mapErrorToHttp(error)
          env.logger.error('Consent failed', { error, status, message })
          res.status(status).render('error', { message })
        },
        (googleAuthUrl) => {
          res.redirect(googleAuthUrl)
        }
      )
    )
  }
}

/**
 * Create consent router with environment
 */
export const createConsentRouter = (env: AppEnvironment) => {
  router.get('/', createConsentHandler(env))
  return router
}

export default router
