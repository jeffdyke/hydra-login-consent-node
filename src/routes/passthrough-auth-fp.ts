/**
 * Functional OAuth2 token endpoint using Effect
 * This demonstrates the functional paradigm vs the imperative passthrough-auth.ts
 */
import express from 'express'
import { Effect, pipe, Layer } from 'effect'
import {
  TokenRequestSchema,
  AuthCodeGrantSchema,
  RefreshTokenGrantSchema,
  createOAuth2Error,
} from '../fp/domain.js'
import { type AppError, InvalidGrant } from '../fp/errors.js'
import { validateSchema } from '../fp/validation.js'
import {
  processAuthCodeGrant,
  processRefreshTokenGrant,
  Logger,
} from '../fp/services/token.js'
import { RedisService } from '../fp/services/redis.js'
import { GoogleOAuthService } from '../fp/services/google.js'

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
        body: createOAuth2Error('invalid_grant', error.errorDescription || error.error),
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
    const program = pipe(
      // Step 1: Validate request body using Effect Schema
      validateSchema(TokenRequestSchema, req.body),

      // Step 2: Process based on grant type (discriminated union)
      Effect.flatMap((tokenRequest) => {
        if (tokenRequest.grant_type === 'authorization_code') {
          // Validate as auth code grant and process
          return pipe(
            validateSchema(AuthCodeGrantSchema, tokenRequest),
            Effect.flatMap((grant) => processAuthCodeGrant(grant))
          )
        } else if (tokenRequest.grant_type === 'refresh_token') {
          // Validate as refresh token grant and process
          return pipe(
            validateSchema(RefreshTokenGrantSchema, tokenRequest),
            Effect.flatMap((grant) => processRefreshTokenGrant(grant))
          )
        } else {
          return Effect.fail(
            new InvalidGrant({
              reason: `Unsupported grant_type: ${(tokenRequest as any).grant_type}`,
            })
          )
        }
      }),

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
      res.status(status).json(body)
    } else {
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
