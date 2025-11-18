/**
 * Functional OAuth2 token endpoint using Effect
 * This demonstrates the functional paradigm vs the imperative passthrough-auth.ts
 */
import { Effect, pipe } from 'effect'
import express from 'express'
import {
  TokenRequestSchema,
  AuthCodeGrantSchema,
  RefreshTokenGrantSchema,
  createOAuth2Error,
} from '../fp/domain.js'
import { type AppError, InvalidGrant } from '../fp/errors.js'
import {
  processAuthCodeGrant,
  processRefreshTokenGrant
} from '../fp/services/token.js'
import { validateSchema } from '../fp/validation.js'
import type { GoogleOAuthService } from '../fp/services/google.js'
import type { RedisService } from '../fp/services/redis.js'
import {
  Logger} from '../fp/services/token.js';
import type { Layer } from 'effect';

const router = express.Router()

/**
 * Map application errors to OAuth2 error responses
 */
const mapErrorToOAuth2 = (error: AppError): { status: number; body: object } => {
  switch (error._tag) {
    // OAuth errors
    case 'InvalidPKCE':
      return {
        status: 400,
        body: createOAuth2Error('invalid_grant', 'PKCE validation failed'),
      }
    case 'InvalidGrant':
      return {
        status: 400,
        body: createOAuth2Error('invalid_grant', error.reason),
      }
    case 'InvalidScope':
      return {
        status: 400,
        body: createOAuth2Error('invalid_scope', 'Requested scope exceeds granted scope'),
      }
    case 'MissingParameter':
      return {
        status: 400,
        body: createOAuth2Error('invalid_request', `${error.parameter} required`),
      }
    case 'ExpiredToken':
      return {
        status: 400,
        body: createOAuth2Error('invalid_grant', 'Token expired'),
      }

    // Redis errors
    case 'RedisKeyNotFound':
      return {
        status: 400,
        body: createOAuth2Error('invalid_grant', 'Invalid or expired authorization code'),
      }

    // Google OAuth errors
    case 'GoogleAuthError':
      return {
        status: 400,
        body: createOAuth2Error('invalid_grant', error.errorDescription ?? error.error),
      }
    case 'GoogleTokenExpired':
    case 'GoogleTokenRevoked':
      return {
        status: 400,
        body: createOAuth2Error('invalid_grant', 'Refresh token expired or revoked'),
      }

    // Validation errors
    case 'SchemaValidationError':
      return {
        status: 400,
        body: createOAuth2Error('invalid_request', 'Invalid request parameters'),
      }
    case 'RequiredFieldMissing':
      return {
        status: 400,
        body: createOAuth2Error('invalid_request', `${error.field} required`),
      }

    // Generic errors
    default:
      return {
        status: 500,
        body: createOAuth2Error('server_error', 'Internal server error'),
      }
  }
}

/**
 * Main token endpoint handler (Effect version)
 *
 * This handler demonstrates:
 * 1. Pure validation using Effect Schema
 * 2. Discriminated unions for grant types
 * 3. Effect.gen for readable async code
 * 4. Context-based dependency injection via Layers
 * 5. No side effects in the handler - all IO wrapped in Effect
 */
export const createTokenHandler = (serviceLayer: Layer.Layer<RedisService | GoogleOAuthService | Logger>) => {

  return async (req: express.Request, res: express.Response) => {

    const program = Effect.gen(function* () {
      const logger = yield* Logger

      // Log incoming request
      yield* logger.debug('Token endpoint called', {
        grant_type: req.body?.grant_type,
        client_id: req.body?.client_id,
        has_code: !!req.body?.code,
        has_refresh_token: !!req.body?.refresh_token,
        has_code_verifier: !!req.body?.code_verifier,
      })

      // Step 1: Validate request body using Effect Schema
      yield* logger.debug('Validating token request schema')
      const tokenRequest = yield* validateSchema(TokenRequestSchema, req.body)
      yield* logger.debug('Token request validated successfully', {
        grant_type: tokenRequest.grant_type,
      })

      // Step 2: Process based on grant type (discriminated union)
      if (tokenRequest.grant_type === 'authorization_code') {
        yield* logger.debug('Processing authorization_code grant', {
          code: tokenRequest.code?.substring(0, 10) + '...',
          client_id: tokenRequest.client_id,
        })
        // Validate as auth code grant and process
        const grant = yield* validateSchema(AuthCodeGrantSchema, tokenRequest)
        yield* logger.debug('Auth code grant validated, processing...')
        const result = yield* processAuthCodeGrant(grant)
        yield* logger.debug('Auth code grant processed successfully', {
          has_access_token: !!result.access_token,
          has_refresh_token: !!result.refresh_token,
          token_type: result.token_type,
          expires_in: result.expires_in,
        })
        return result
      } else if (tokenRequest.grant_type === 'refresh_token') {
        yield* logger.debug('Processing refresh_token grant', {
          refresh_token: tokenRequest.refresh_token?.substring(0, 10) + '...',
          client_id: tokenRequest.client_id,
        })
        // Validate as refresh token grant and process
        const grant = yield* validateSchema(RefreshTokenGrantSchema, tokenRequest)
        yield* logger.debug('Refresh token grant validated, processing...')
        const result = yield* processRefreshTokenGrant(grant)
        yield* logger.debug('Refresh token grant processed successfully', {
          has_access_token: !!result.access_token,
          has_refresh_token: !!result.refresh_token,
          token_type: result.token_type,
          expires_in: result.expires_in,
        })
        return result
      } else {
        yield* logger.debug('Unsupported grant type received', {
          grant_type: (tokenRequest as any).grant_type,
        })
        return yield* Effect.fail(
          new InvalidGrant({
            reason: `Unsupported grant_type: ${(tokenRequest as any).grant_type}`,
          })
        )
      }
    }).pipe(
      // Provide service layer
      Effect.provide(serviceLayer)
    )

    // Step 3: Run the effect and handle result
    const result = await Effect.runPromise(
      Effect.either(program)
    )

    // Step 4: Send response based on result
    if (result._tag === 'Left') {
      const { status, body } = mapErrorToOAuth2(result.left)
      console.debug('[TokenHandler] Request failed:', {
        error_tag: result.left._tag,
        status,
      })
      res.status(status).json(body)
    } else {
      console.debug('[TokenHandler] Request succeeded')
      res.json(result.right)
    }
  }
}

/**
 * Router factory (will be used when we have service layer available)
 */
export const createTokenRouter = (serviceLayer: Layer.Layer<RedisService | GoogleOAuthService | Logger>) => {
  router.post('/token', createTokenHandler(serviceLayer))
  return router
}

export default router
