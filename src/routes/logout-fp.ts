/**
 * Functional logout route using Effect
 */
import { Effect, pipe } from 'effect'
import express from 'express'
import { generateCsrfToken } from '../config.js'
import { type AppError } from '../fp/errors.js'
import { getLogoutInfo, acceptLogout, rejectLogout } from '../fp/services/logout.js'
import type { HydraService } from '../fp/services/hydra.js'
import type { Logger } from '../fp/services/token.js'
import type { Layer } from 'effect';

const router = express.Router()

/**
 * Configuration for logout
 */
export interface LogoutConfig {
  readonly hostName: string
}

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
const createLogoutGetHandler = (
  serviceLayer: Layer.Layer<HydraService | Logger>,
  config: LogoutConfig
) => {
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

    const program = pipe(
      getLogoutInfo(challenge),
      Effect.provide(serviceLayer)
    )

    const result = await Effect.runPromise(Effect.either(program))

    if (result._tag === 'Left') {
      const { status, message } = mapErrorToHttp(result.left)
      res.status(status).send(message)
    } else {
      res.render('logout', {
        csrfToken: generateCsrfToken(req, res),
        envXsrfToken: config.hostName,
        challenge: result.right.challenge,
        action: `${config.hostName}/logout`,
      })
    }
  }
}

/**
 * POST /logout - Accept or reject logout
 */
const createLogoutPostHandler = (serviceLayer: Layer.Layer<HydraService | Logger>) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const challenge = req.body.challenge
    const submit = req.body.submit

    if (!challenge) {
      res.status(400).send('Missing logout challenge')
      return
    }

    // User chose not to logout
    if (submit === 'No') {
      const program = pipe(
        rejectLogout(challenge),
        Effect.provide(serviceLayer)
      )

      const result = await Effect.runPromise(Effect.either(program))

      if (result._tag === 'Left') {
        const { status, message } = mapErrorToHttp(result.left)
        next(result.left)
      } else {
        // User did not want to log out, redirect somewhere
        res.redirect('https://www.ory.sh/')
      }
      return
    }

    // User agreed to logout
    const program = pipe(
      acceptLogout(challenge),
      Effect.provide(serviceLayer)
    )

    const result = await Effect.runPromise(Effect.either(program))

    if (result._tag === 'Left') {
      const { status, message } = mapErrorToHttp(result.left)
      next(result.left)
    } else {
      res.redirect(result.right)
    }
  }
}

/**
 * Create logout router with service layer
 */
export const createLogoutRouter = (
  serviceLayer: Layer.Layer<HydraService | Logger>,
  config: LogoutConfig
) => {
  router.get('/', createLogoutGetHandler(serviceLayer, config))
  router.post('/', createLogoutPostHandler(serviceLayer))
  return router
}

export default router
