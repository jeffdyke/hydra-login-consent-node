/**
 * Functional logout route using fp-ts
 */
import express from 'express'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import { AppEnvironment } from '../fp/environment.js'
import { AppError } from '../fp/errors.js'
import { getLogoutInfo, acceptLogout, rejectLogout } from '../fp/services/logout.js'
import { generateCsrfToken } from '../config.js'

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
    default:
      return { status: 500, message: 'Internal server error' }
  }
}

/**
 * GET /logout - Display logout confirmation form
 */
const createLogoutGetHandler = (env: AppEnvironment) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const challenge = String(req.query.logout_challenge)

    if (!challenge) {
      next(new Error('Expected a logout challenge to be set but received none.'))
      return
    }

    const result = await getLogoutInfo(challenge)(env)()

    pipe(
      result,
      E.fold(
        (error) => {
          const { status, message } = mapErrorToHttp(error)
          env.logger.error('Get logout info failed', { error, status, message })
          res.status(status).send(message)
        },
        (logoutInfo) => {
          res.render('logout', {
            csrfToken: generateCsrfToken(req, res),
            envXsrfToken: env.config.hostName,
            challenge: logoutInfo.challenge,
            action: `${env.config.hostName}/logout`,
          })
        }
      )
    )
  }
}

/**
 * POST /logout - Accept or reject logout
 */
const createLogoutPostHandler = (env: AppEnvironment) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const challenge = req.body.challenge
    const submit = req.body.submit

    if (!challenge) {
      res.status(400).send('Missing logout challenge')
      return
    }

    // User chose not to logout
    if (submit === 'No') {
      const result = await rejectLogout(challenge)(env)()

      pipe(
        result,
        E.fold(
          (error) => {
            const { status, message } = mapErrorToHttp(error)
            env.logger.error('Reject logout failed', { error, status, message })
            next(error)
          },
          () => {
            // User did not want to log out, redirect somewhere
            res.redirect('https://www.ory.sh/')
          }
        )
      )
      return
    }

    // User agreed to logout
    const result = await acceptLogout(challenge)(env)()

    pipe(
      result,
      E.fold(
        (error) => {
          const { status, message } = mapErrorToHttp(error)
          env.logger.error('Accept logout failed', { error, status, message })
          next(error)
        },
        (redirectUrl) => {
          res.redirect(redirectUrl)
        }
      )
    )
  }
}

/**
 * Create logout router with environment
 */
export const createLogoutRouter = (env: AppEnvironment) => {
  router.get('/', createLogoutGetHandler(env))
  router.post('/', createLogoutPostHandler(env))
  return router
}

export default router
