/**
 * Login flow business logic using ReaderTaskEither
 */
import * as RTE from 'fp-ts/ReaderTaskEither'
import { pipe } from 'fp-ts/function'
import { AppEnvironment } from '../environment.js'
import { AppError } from '../errors.js'

/**
 * Process login request
 * Auto-accepts login with provided subject
 */
export const processLogin = (
  challenge: string,
  subject: string
): RTE.ReaderTaskEither<AppEnvironment, AppError, string> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      env.logger.debug('Processing login challenge', { challenge, subject })

      return pipe(
        // Get login request details
        RTE.fromTaskEither(env.hydra.getLoginRequest(challenge)),

        // Log client info
        RTE.chainFirstW((loginRequest) => {
          env.logger.debug('Login request received', {
            clientId: loginRequest.client?.client_id,
          })
          return RTE.right(undefined)
        }),

        // Accept login request
        RTE.chainW(() =>
          RTE.fromTaskEither(
            env.hydra.acceptLoginRequest(challenge, {
              subject,
              remember: true,
              remember_for: 3600,
              acr: '0', // Authentication Context Class Reference
            })
          )
        ),

        // Extract redirect URL
        RTE.map((redirectTo) => {
          env.logger.debug('Login accepted, redirecting to', {
            redirect_to: redirectTo.redirect_to,
          })
          return String(redirectTo.redirect_to)
        })
      )
    })
  )
