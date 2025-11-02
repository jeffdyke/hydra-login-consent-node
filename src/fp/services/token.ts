/**
 * OAuth2 Token Service - Core business logic for token operations
 * Uses ReaderTaskEither for dependency injection and error handling
 */
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as TE from 'fp-ts/TaskEither'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import {
  AuthCodeGrant,
  RefreshTokenGrant,
  OAuth2TokenResponse,
  PKCEStateCodec,
  AuthCodeDataCodec,
  RefreshTokenDataCodec,
  RefreshTokenData,
  GoogleTokenResponse,
} from '../domain.js'
import { AppEnvironment } from '../environment.js'
import { AppError, OAuthError, RedisError, ValidationError } from '../errors.js'
import { validatePKCE, parseScopeString, validateScopes } from '../validation.js'
import { createOAuthRedisOps } from './redis.js'

/**
 * Process authorization_code grant type
 * Pipeline: Fetch auth data -> Validate PKCE -> Create tokens -> Store refresh token
 */
export const processAuthCodeGrant = (
  grant: AuthCodeGrant
): RTE.ReaderTaskEither<AppEnvironment, AppError, OAuth2TokenResponse> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      const redisOps = createOAuthRedisOps(env.redis)

      return pipe(
        // Step 1: Fetch auth code data and PKCE state from Redis
        RTE.fromTaskEither(
          pipe(
            TE.Do,
            TE.bindW('authData', () =>
              redisOps.getAuthCode(grant.code, AuthCodeDataCodec)
            ),
            TE.bindW('pkceState', () =>
              redisOps.getAuthCodeState(grant.code, PKCEStateCodec)
            )
          )
        ),

        // Step 2: Clean up one-time use auth codes (runs regardless of validation)
        RTE.chainFirstW((_) =>
          RTE.fromTaskEither(
            pipe(
              TE.Do,
              TE.chainW(() => redisOps.deleteAuthCode(grant.code)),
              TE.chainW(() => redisOps.deleteAuthCodeState(grant.code))
            )
          )
        ),

        // Step 3: Validate PKCE
        RTE.chainW(({ authData, pkceState }) =>
          pipe(
            validatePKCE(
              grant.code_verifier,
              pkceState.code_challenge,
              pkceState.code_challenge_method
            ),
            RTE.fromEither,
            RTE.map(() => ({ authData, pkceState }))
          )
        ),

        // Step 4: Create refresh token data
        RTE.chainW(({ authData, pkceState }) => {
          const tokenObj = authData.google_tokens.tokens
          const refreshTokenData: RefreshTokenData = {
            client_id: pkceState.client_id,
            refresh_token: tokenObj.refresh_token || '',
            access_token: tokenObj.access_token,
            scope: tokenObj.scope,
            subject: authData.subject || 'user',
            created_at: Date.now(),
            expires_in: tokenObj.expires_in,
            updated_at: Date.now()
          }

          env.logger.silly('Created refresh token data', refreshTokenData)

          // Step 5: Store refresh token in Redis
          return pipe(
            RTE.fromTaskEither(
              redisOps.setRefreshToken(
                refreshTokenData.refresh_token,
                refreshTokenData
              )
            ),
            RTE.map(() => refreshTokenData)
          )
        }),

        // Step 6: Build OAuth2 token response
        RTE.map((refreshTokenData) => {
          const response: OAuth2TokenResponse = {
            access_token: refreshTokenData.access_token,
            token_type: 'Bearer',
            expires_in: refreshTokenData.expires_in,
            refresh_token: refreshTokenData.refresh_token,
            scope: refreshTokenData.scope,
          }

          env.logger.info('Returning OAuth2 token response', response)
          return response
        })
      )
    })
  )

/**
 * Process refresh_token grant type
 * Pipeline: Fetch token data -> Validate scopes -> Refresh Google token -> Update storage
 */
export const processRefreshTokenGrant = (
  grant: RefreshTokenGrant
): RTE.ReaderTaskEither<AppEnvironment, AppError, OAuth2TokenResponse> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW((env) => {
      const redisOps = createOAuthRedisOps(env.redis)

      return pipe(
        // Step 1: Validate required fields
        RTE.fromEither(
          grant.refresh_token
            ? E.right(grant.refresh_token)
            : E.left(OAuthError.missingParameter('refresh_token'))
        ),

        // Step 2: Fetch stored refresh token data
        RTE.chainW((refreshToken) =>
          pipe(
            RTE.fromTaskEither(
              redisOps.getRefreshToken(refreshToken, RefreshTokenDataCodec)
            ),
            RTE.map((tokenData) => ({ refreshToken, tokenData }))
          )
        ),

        // Step 3: Validate scopes if requested
        RTE.chainW(({ refreshToken, tokenData }) => {
          if (grant.scope) {
            const requestedScopes = parseScopeString(grant.scope)
            const grantedScopes = parseScopeString(tokenData.scope)

            return pipe(
              validateScopes(requestedScopes, grantedScopes),
              RTE.fromEither,
              RTE.map(() => ({ refreshToken, tokenData }))
            )
          }
          return RTE.right({ refreshToken, tokenData })
        }),

        // Step 4: Refresh Google access token
        RTE.chainW(({ refreshToken, tokenData }) =>
          pipe(
            RTE.fromTaskEither(env.google.refreshToken(tokenData)),
            RTE.map((googleResponse) => ({
              refreshToken,
              tokenData,
              googleResponse,
            }))
          )
        ),

        // Step 5: Check for Google errors
        RTE.chainW(({ refreshToken, tokenData, googleResponse }) => {
          // If Google returned an error, handle it
          const anyError = (googleResponse as any).error
          if (anyError) {
            env.logger.error('Google refresh token error', { error: anyError })

            // Delete invalid refresh token
            return pipe(
              RTE.fromTaskEither(redisOps.deleteRefreshToken(refreshToken)),
              RTE.chainW(() =>
                RTE.left(
                  OAuthError.invalidGrant(
                    (googleResponse as any).error_description ||
                      'Refresh token expired or revoked'
                  )
                )
              )
            )
          }

          return RTE.right({ refreshToken, tokenData, googleResponse })
        }),

        // Step 6: Update stored refresh token
        RTE.chainW(({ refreshToken, tokenData, googleResponse }) => {
          const updatedRefreshToken =
            googleResponse.refresh_token || tokenData.refresh_token

          const updatedData: RefreshTokenData = {
            ...tokenData,
            refresh_token: updatedRefreshToken,
            access_token: googleResponse.access_token,
            updated_at: Date.now(),
          }

          return pipe(
            RTE.fromTaskEither(
              redisOps.setRefreshToken(updatedRefreshToken, updatedData)
            ),
            RTE.map(() => ({ googleResponse, updatedData, updatedRefreshToken }))
          )
        }),

        // Step 7: Build OAuth2 token response
        RTE.map(({ googleResponse, updatedData, updatedRefreshToken }) => {
          const response: OAuth2TokenResponse = {
            access_token: googleResponse.access_token,
            token_type: 'Bearer',
            expires_in: googleResponse.expires_in,
            refresh_token: updatedRefreshToken,
            scope: googleResponse.scope || updatedData.scope,
          }

          env.logger.info('Returning refreshed OAuth2 token response', response)
          return response
        })
      )
    })
  )
