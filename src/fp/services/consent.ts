/**
 * Consent flow business logic using ReaderTaskEither
 */
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as TE from 'fp-ts/TaskEither'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import { AppEnvironment } from '../environment.js'
import { AppError, ValidationError } from '../errors.js'

/**
 * Build Google OAuth URL
 */
const buildGoogleAuthUrl = (
  config: {
    googleClientId: string
    middlewareRedirectUri: string
  },
  state: string
): string => {
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', config.googleClientId)
  googleAuthUrl.searchParams.set('redirect_uri', config.middlewareRedirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid profile email')
  googleAuthUrl.searchParams.set('state', state)
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')
  return googleAuthUrl.toString()
}

/**
 * Process consent request
 * 1. Get consent info from Hydra
 * 2. Accept consent
 * 3. Get PKCE state from Redis
 * 4. Build and return Google OAuth URL
 */
export const processConsent = (
  challenge: string,
  requestedScope?: string
): RTE.ReaderTaskEither<AppEnvironment, AppError, string> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      env.logger.debug('Processing consent challenge', { challenge })

      return pipe(
        // Step 1: Get consent info
        RTE.fromTaskEither(env.hydra.getConsentRequest(challenge)),

        // Step 2: Accept consent with requested scopes
        RTE.chainW((consentInfo) => {
          env.logger.info('Consent info received', {
            subject: consentInfo.subject,
            requestedScopes: consentInfo.requested_scope,
          })

          return RTE.fromTaskEither(
            env.hydra.acceptConsentRequest(challenge, {
              grant_scope: requestedScope ? [requestedScope] : consentInfo.requested_scope,
              grant_access_token_audience: consentInfo.requested_access_token_audience,
              session: {
                id_token: {},
                access_token: {},
              },
              remember: true,
              remember_for: 3600,
            })
          )
        }),

        // Step 3: Build Google OAuth URL
        RTE.map(() => {
          // Note: In the original code, state comes from PKCE in Redis via session
          // For now, we'll use a simplified approach. In production, you'd fetch
          // from Redis using session ID
          const googleUrl = buildGoogleAuthUrl(
            {
              googleClientId: env.config.googleClientId,
              middlewareRedirectUri: env.config.middlewareRedirectUri,
            },
            challenge // Using challenge as state for now
          )

          env.logger.info('Redirecting to Google OAuth', { url: googleUrl })
          return googleUrl
        })
      )
    })
  )

/**
 * Process consent with PKCE from session
 * This version fetches PKCE state from Redis first
 */
export const processConsentWithPKCE = (
  challenge: string,
  sessionId: string,
  requestedScope?: string
): RTE.ReaderTaskEither<AppEnvironment, AppError, string> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      const redisOps = { getPKCEState: env.redis.getJSON }

      return pipe(
        // Fetch PKCE from Redis
        RTE.fromTaskEither(
          redisOps.getPKCEState(`pkce_session:${sessionId}`, E.right as any)
        ),

        // Continue with consent flow
        RTE.chainW((pkceData: any) =>
          pipe(
            processConsent(challenge, requestedScope),
            RTE.map((baseUrl) => {
              // Use actual state from PKCE
              const url = new URL(baseUrl)
              url.searchParams.set('state', pkceData.state || challenge)
              return url.toString()
            })
          )
        )
      )
    })
  )
