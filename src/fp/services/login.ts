/**
 * Login flow business logic using Effect
 */
import { Effect } from 'effect'
import { HydraService } from './hydra.js'
import { type AppError } from '../errors.js'
import { Logger } from './token.js'

/**
 * Process login request
 * Auto-accepts login with provided subject
 */
export const processLogin = (
  challenge: string,
  subject: string
): Effect.Effect<string, AppError, HydraService | Logger> =>
  Effect.gen(function* () {
    // Access services
    const hydra = yield* HydraService
    const logger = yield* Effect.serviceOption(Logger)

    if (logger._tag === 'Some') {
      yield* logger.value.info('Processing login challenge', { challenge, subject })
    }

    // Get login request details
    const loginRequest = yield* hydra.getLoginRequest(challenge)

    if (logger._tag === 'Some') {
      yield* logger.value.info('Login request received', {
        clientId: loginRequest.client?.client_id,
      })
    }

    // Accept login request
    const redirectTo = yield* hydra.acceptLoginRequest(challenge, {
      subject,
      remember: true,
      remember_for: 3600,
      acr: '0', // Authentication Context Class Reference
    })

    if (logger._tag === 'Some') {
      yield* logger.value.info('Login accepted, redirecting to', {
        redirect_to: redirectTo.redirect_to,
      })
    }

    return String(redirectTo.redirect_to)
  })
