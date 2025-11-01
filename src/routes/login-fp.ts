/**
 * Functional login route using fp-ts
 */
import express from 'express'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import { AppEnvironment } from '../fp/environment.js'
import { AppError } from '../fp/errors.js'
import { processLogin } from '../fp/services/login.js'

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
const createLoginHandler = (env: AppEnvironment) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const challenge = String(req.query.login_challenge || req.body.challenge)

    if (!challenge) {
      next(new Error('Expected a login challenge to be set but received none.'))
      return
    }

    const result = await processLogin(challenge, SUBJECT_PLACEHOLDER)(env)()

    pipe(
      result,
      E.fold(
        (error) => {
          const { status, message } = mapErrorToHttp(error)
          env.logger.error('Login failed', { error, status, message })
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
 * Create login router with environment
 */
export const createLoginRouter = (env: AppEnvironment) => {
  const handler = createLoginHandler(env)

  router.get('/', handler)
  router.post('/', handler)

  return router
}

export default router
