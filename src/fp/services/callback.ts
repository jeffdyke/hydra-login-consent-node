/**
 * Google OAuth callback business logic using ReaderTaskEither
 */
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'
import * as crypto from 'crypto'
import { AppEnvironment } from '../environment.js'
import { AppError } from '../errors.js'
import { PKCEStateCodec, AuthCodeData } from '../domain.js'
import { createOAuthRedisOps } from './redis.js'

/**
 * Google OAuth tokens (from google-auth-library)
 */
interface GoogleOAuthTokens {
  tokens: {
    access_token: string
    refresh_token: string | undefined
    scope: string
    expires_in: number
    id_token: string | undefined
    token_type: string
  }
}

/**
 * Exchange Google authorization code for tokens
 * Using google-auth-library OAuth2Client
 */
const exchangeGoogleCode = (
  code: string,
  redirectUri: string,
  googleClient: any
): TE.TaskEither<AppError, GoogleOAuthTokens> =>
  TE.tryCatch(
    async () => {
      const tokenResponse = await googleClient.getToken(code)
      return tokenResponse
    },
    (error) => ({
      _tag: 'GoogleAuthError' as const,
      error: 'token_exchange_failed',
      errorDescription: String(error),
    })
  )

/**
 * Process OAuth callback
 * 1. Fetch PKCE state from Redis
 * 2. Exchange Google auth code for tokens
 * 3. Generate new auth_code for passthrough
 * 4. Store auth_code and state in Redis
 * 5. Delete PKCE session
 * 6. Build redirect URL with new auth_code
 */
export const processCallback = (
  googleCode: string,
  returnedState: string,
  pkceKey: string,
  googleClient: any
): RTE.ReaderTaskEither<AppEnvironment, AppError, string> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      const redisOps = createOAuthRedisOps(env.redis)

      env.logger.debug('Processing OAuth callback', {
        code: googleCode,
        returnedState,
        pkceKey,
      })

      return pipe(
        // Step 1: Fetch PKCE data from Redis
        RTE.fromTaskEither(redisOps.getPKCEState(pkceKey, PKCEStateCodec)),

        // Step 2: Exchange Google code for tokens
        RTE.chainW((pkceData) => {
          env.logger.debug('PKCE data fetched', {
            state: pkceData.state,
            challenge: pkceData.code_challenge,
          })

          return pipe(
            RTE.fromTaskEither(
              exchangeGoogleCode(
                googleCode,
                env.config.middlewareRedirectUri,
                googleClient
              )
            ),
            RTE.map((googleTokens) => ({ pkceData, googleTokens }))
          )
        }),

        // Step 3: Generate new auth_code for passthrough
        RTE.chainW(({ pkceData, googleTokens }) => {
          const authCode = crypto.randomBytes(32).toString('base64url')

          const authData: AuthCodeData = {
            google_tokens: googleTokens,
            subject: undefined, // Will be populated from user info if needed
          }

          env.logger.debug('Generated auth_code', { authCode })

          return pipe(
            // Store PKCE state with auth_code
            RTE.fromTaskEither(
              pipe(
                TE.Do,
                TE.chainW(() => redisOps.setAuthCodeState(authCode, pkceData)),
                TE.chainW(() => redisOps.setAuthCode(authCode, authData, 300))
              )
            ),
            RTE.map(() => ({ pkceData, authCode }))
          )
        }),

        // Step 4: Delete PKCE session (cleanup)
        RTE.chainFirstW(({ pkceData }) =>
          pipe(
            RTE.fromTaskEither(redisOps.deletePKCEState(pkceKey)),
            RTE.map(() => undefined),
            RTE.orElse((err) => {
              env.logger.warn('Failed to delete PKCE session', { err, pkceKey })
              return RTE.right(undefined) // Continue even if deletion fails
            })
          )
        ),

        // Step 5: Build redirect URL
        RTE.map(({ pkceData, authCode }) => {
          const ptCallback = new URL(pkceData.redirect_uri)
          ptCallback.searchParams.set('code', authCode)
          ptCallback.searchParams.set('state', pkceData.state)

          env.logger.info('Callback complete, redirecting', {
            redirectUri: ptCallback.toString(),
          })

          return ptCallback.toString()
        })
      )
    })
  )
