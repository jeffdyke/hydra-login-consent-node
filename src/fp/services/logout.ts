/**
 * Logout flow business logic using ReaderTaskEither
 */
import * as RTE from 'fp-ts/ReaderTaskEither'
import { pipe } from 'fp-ts/function'
import { AppEnvironment } from '../environment.js'
import { AppError } from '../errors.js'

/**
 * Get logout request information
 * Returns challenge and subject for rendering confirmation form
 */
export const getLogoutInfo = (
  challenge: string
): RTE.ReaderTaskEither<
  AppEnvironment,
  AppError,
  { challenge: string; subject?: string }
> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      env.logger.debug('Getting logout request info', { challenge })

      return pipe(
        RTE.fromTaskEither(env.hydra.getLogoutRequest(challenge)),
        RTE.map((logoutRequest) => ({
          challenge,
          subject: logoutRequest.subject,
        }))
      )
    })
  )

/**
 * Accept logout request
 */
export const acceptLogout = (
  challenge: string
): RTE.ReaderTaskEither<AppEnvironment, AppError, string> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      env.logger.debug('Accepting logout request', { challenge })

      return pipe(
        RTE.fromTaskEither(env.hydra.acceptLogoutRequest(challenge)),
        RTE.map((redirectTo) => {
          env.logger.info('Logout accepted, redirecting', {
            redirect_to: redirectTo.redirect_to,
          })
          return String(redirectTo.redirect_to)
        })
      )
    })
  )

/**
 * Reject logout request
 */
export const rejectLogout = (
  challenge: string
): RTE.ReaderTaskEither<AppEnvironment, AppError, void> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      env.logger.debug('Rejecting logout request', { challenge })

      return RTE.fromTaskEither(env.hydra.rejectLogoutRequest(challenge))
    })
  )
