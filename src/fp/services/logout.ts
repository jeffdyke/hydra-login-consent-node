/**
 * Logout flow business logic using Effect
 */
import { Effect } from 'effect'
import { type AppError } from '../errors.js'
import { HydraService } from './hydra.js'
import { Logger } from './token.js'

/**
 * Get logout request information
 * Returns challenge and subject for rendering confirmation form
 */
export const getLogoutInfo = (
  challenge: string
): Effect.Effect<
  { challenge: string; subject?: string },
  AppError,
  HydraService | Logger
> =>
  Effect.gen(function* () {
    // Access services
    const hydra = yield* HydraService
    const logger = yield* Effect.serviceOption(Logger)

    if (logger._tag === 'Some') {
      yield* logger.value.info('Getting logout request info', { challenge })
    }

    const logoutRequest = yield* hydra.getLogoutRequest(challenge)

    return {
      challenge,
      subject: logoutRequest.subject,
    }
  })

/**
 * Accept logout request
 */
export const acceptLogout = (
  challenge: string
): Effect.Effect<string, AppError, HydraService | Logger> =>
  Effect.gen(function* () {
    // Access services
    const hydra = yield* HydraService
    const logger = yield* Effect.serviceOption(Logger)

    if (logger._tag === 'Some') {
      yield* logger.value.info('Accepting logout request', { challenge })
    }

    const redirectTo = yield* hydra.acceptLogoutRequest(challenge)

    if (logger._tag === 'Some') {
      yield* logger.value.info('Logout accepted, redirecting', {
        redirect_to: redirectTo.redirect_to,
      })
    }

    return String(redirectTo.redirect_to)
  })

/**
 * Reject logout request
 */
export const rejectLogout = (
  challenge: string
): Effect.Effect<void, AppError, HydraService | Logger> =>
  Effect.gen(function* () {
    // Access services
    const hydra = yield* HydraService
    const logger = yield* Effect.serviceOption(Logger)

    if (logger._tag === 'Some') {
      yield* logger.value.info('Rejecting logout request', { challenge })
    }

    yield* hydra.rejectLogoutRequest(challenge)
  })
