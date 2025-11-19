/**
 * OAuth2 Token Service - Effect version
 * Uses Effect.gen for readable async code with dependency injection
 */
import { Effect } from 'effect'
import {
  PKCEStateSchema,
  AuthCodeDataSchema,
  RefreshTokenDataSchema
} from '../domain.js'
import {
  type AppError,
  MissingParameter,
} from '../errors.js'
import { validatePKCE, parseScopeString, validateScopes } from '../validation.js'
import { GoogleOAuthService } from './google.js'
import { RedisService, createOAuthRedisOps } from './redis.js'
import type {
  AuthCodeGrant,
  RefreshTokenGrant,
  OAuth2TokenResponse,
  RefreshTokenData} from '../domain.js';

/**
 * Process authorization_code grant type (Effect version)
 * Pipeline: Fetch auth data -> Validate PKCE -> Create tokens -> Store refresh token
 */
export const processAuthCodeGrant = (
  grant: AuthCodeGrant
): Effect.Effect<OAuth2TokenResponse, AppError, RedisService> =>
  Effect.gen(function* () {
    // Access services from context
    const redis = yield* RedisService

    const redisOps = createOAuthRedisOps(redis)

    // Step 1: Fetch auth code data and PKCE state from Redis (parallel)
    const [authData, pkceState] = yield* Effect.all([
      redisOps.getAuthCode(grant.code, AuthCodeDataSchema),
      redisOps.getAuthCodeState(grant.code, PKCEStateSchema),
    ])

    // Step 2: Clean up one-time use auth codes (sequential)
    yield* redisOps.deleteAuthCode(grant.code)
    yield* redisOps.deleteAuthCodeState(grant.code)

    // Step 3: Validate PKCE
    yield* validatePKCE(
      grant.code_verifier,
      pkceState.code_challenge,
      pkceState.code_challenge_method
    )

    // Step 4: Create refresh token data
    const tokenObj = authData.google_tokens.tokens
    const refreshTokenData: RefreshTokenData = {
      client_id: pkceState.client_id,
      refresh_token: tokenObj.refresh_token ?? '',
      access_token: tokenObj.access_token,
      scope: tokenObj.scope,
      subject: authData.subject ?? 'user',
      created_at: Date.now(),
      expires_in: tokenObj.expires_in,
      updated_at: Date.now(),
    }

    // Log created token data
    yield* Effect.logTrace('Created refresh token data').pipe(
      Effect.annotateLogs(refreshTokenData)
    )

    // Step 5: Store refresh token in Redis
    yield* redisOps.setRefreshToken(
      refreshTokenData.refresh_token,
      refreshTokenData
    )

    // Step 6: Build OAuth2 token response
    const response: OAuth2TokenResponse = {
      access_token: refreshTokenData.access_token,
      token_type: 'Bearer',
      expires_in: refreshTokenData.expires_in,
      refresh_token: refreshTokenData.refresh_token,
      scope: refreshTokenData.scope,
    }

    yield* Effect.logInfo('Returning OAuth2 token response').pipe(
      Effect.annotateLogs(response)
    )

    return response
  })

/**
 * Process refresh_token grant type (Effect version)
 * Pipeline: Fetch token data -> Validate scopes -> Refresh Google token -> Update storage
 */
export const processRefreshTokenGrant = (
  grant: RefreshTokenGrant
): Effect.Effect<
  OAuth2TokenResponse,
  AppError,
  RedisService | GoogleOAuthService
> =>
  Effect.gen(function* () {
    // Access services
    const redis = yield* RedisService
    const google = yield* GoogleOAuthService

    const redisOps = createOAuthRedisOps(redis)

    // Step 1: Validate required fields
    if (!grant.refresh_token) {
      return yield* Effect.fail(new MissingParameter({ parameter: 'refresh_token' }))
    }

    const refreshToken = grant.refresh_token

    // Step 2: Fetch stored refresh token data
    const tokenData = yield* redisOps.getRefreshToken(
      refreshToken,
      RefreshTokenDataSchema
    )
    yield* Effect.logTrace('Fetched stored refresh token data').pipe(
      Effect.annotateLogs({ refresh: refreshToken, token: tokenData })
    )

    // Step 3: Validate scopes if requested
    if (grant.scope) {
      const requestedScopes = parseScopeString(grant.scope)
      const grantedScopes = parseScopeString(tokenData.scope)

      yield* validateScopes(requestedScopes, grantedScopes)
    }

    // Step 4: Refresh Google access token, if needed or return existing
    if (tokenData.expires_in > 4000) {
      // Token not expired (more than 5 minutes left), return existing
      yield* Effect.logDebug('Existing access token still valid, returning it').pipe(
        Effect.annotateLogs({ expires_in: tokenData.expires_in })
      )
      const response: OAuth2TokenResponse = {
        access_token: tokenData.access_token,
        token_type: 'Bearer',
        expires_in: tokenData.expires_in,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
      }
      return response
    } else {
      const googleResponse = yield* google.refreshToken(tokenData)

      // Step 5: Check for Google errors (already handled by Effect error channel)
      // No need for manual error checking - Effect handles it!

      // Step 6: Update stored refresh token
      const updatedRefreshToken =
        googleResponse.refresh_token ?? tokenData.refresh_token

      const updatedData: RefreshTokenData = {
        ...tokenData,
        refresh_token: updatedRefreshToken,
        access_token: googleResponse.access_token,
        updated_at: Date.now(),
      }

      yield* redisOps.setRefreshToken(updatedRefreshToken, updatedData)

      // Step 7: Build OAuth2 token response
      const response: OAuth2TokenResponse = {
        access_token: googleResponse.access_token,
        token_type: 'Bearer',
        expires_in: googleResponse.expires_in,
        refresh_token: updatedRefreshToken,
        scope: googleResponse.scope ?? updatedData.scope,
      }

      yield* Effect.logInfo('Returning refreshed OAuth2 token response').pipe(
        Effect.annotateLogs(response)
      )

      return response
    }
  })
