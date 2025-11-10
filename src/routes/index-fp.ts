/**
 * Functional index route using Effect
 *
 * Health check endpoints for monitoring and testing.
 * These are not part of the OAuth2 flow and don't require CSRF protection.
 */
import { Effect, pipe } from 'effect'
import express from 'express'
import { Logger } from '../fp/services/token.js'
import type { Layer } from 'effect'

const router = express.Router()

/**
 * HEAD / - Health check endpoint (headers only)
 */
const createHeadHandler = (serviceLayer: Layer.Layer<Logger>) => {
  return async (req: express.Request, res: express.Response) => {
    const program = pipe(
      Effect.gen(function* () {
        const logger = yield* Effect.serviceOption(Logger)

        if (logger._tag === 'Some') {
          yield* logger.value.info('HEAD / request received', {
            headers: req.headers,
          })
        }

        return 'No Change'
      }),
      Effect.provide(serviceLayer)
    )

    await Effect.runPromise(Effect.either(program))

    res.set('X-BondLink-Special', 'Head-Only-Value')
    res.status(200).end()
  }
}

/**
 * GET / - Health check endpoint
 */
const createGetHandler = (serviceLayer: Layer.Layer<Logger>) => {
  return async (req: express.Request, res: express.Response) => {
    const program = pipe(
      Effect.gen(function* () {
        const logger = yield* Effect.serviceOption(Logger)

        if (logger._tag === 'Some') {
          yield* logger.value.info('GET / request received', {
            headers: req.headers,
          })
        }

        return 'No Change'
      }),
      Effect.provide(serviceLayer)
    )

    await Effect.runPromise(Effect.either(program))

    res.set('X-BondLink-Special', 'Head-Only-Value')
    res.status(200).end()
  }
}

/**
 * POST / - Health check endpoint (for testing)
 */
const createPostHandler = (serviceLayer: Layer.Layer<Logger>) => {
  return async (req: express.Request, res: express.Response) => {
    const program = pipe(
      Effect.gen(function* () {
        const logger = yield* Effect.serviceOption(Logger)

        if (logger._tag === 'Some') {
          yield* logger.value.info('POST / request received', {
            headers: req.headers,
          })
        }

        return 'No Change'
      }),
      Effect.provide(serviceLayer)
    )

    await Effect.runPromise(Effect.either(program))

    res.set('X-BondLink-Special', 'Head-Only-Value')
    res.status(200).end()
  }
}

/**
 * Create index router with service layer
 */
export const createIndexRouter = (serviceLayer: Layer.Layer<Logger>) => {
  router.head('/', createHeadHandler(serviceLayer))
  router.get('/', createGetHandler(serviceLayer))
  router.post('/', createPostHandler(serviceLayer))
  return router
}

export default router
