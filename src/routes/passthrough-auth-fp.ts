/**
 * Functional OAuth2 token endpoint using fp-ts
 * This demonstrates the functional paradigm vs the imperative passthrough-auth.ts
 */
import express from 'express'
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as TE from 'fp-ts/TaskEither'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import {
  TokenRequestCodec,
  AuthCodeGrantCodec,
  RefreshTokenGrantCodec,
  AuthCodeGrant,
  createOAuth2Error,
  RefreshTokenGrant,
} from '../fp/domain.js'
import { AppEnvironment } from '../fp/environment.js'
import { AppError, OAuthError, RedisError, GoogleOAuthError, ValidationError } from '../fp/errors.js'
import { validateCodec } from '../fp/validation.js'
import {
  processAuthCodeGrant,
  processRefreshTokenGrant,
} from '../fp/services/token.js'

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
    case 'CodecValidationError':
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
 * Main token endpoint handler (functional version)
 *
 * This handler demonstrates:
 * 1. Pure validation using io-ts codecs
 * 2. Discriminated unions for grant types
 * 3. ReaderTaskEither for dependency injection
 * 4. Composable error handling with Either
 * 5. No side effects in the handler - all IO wrapped in TaskEither
 */
export const createTokenHandler = (env: AppEnvironment) => {
  return async (req: express.Request, res: express.Response) => {
    const result = await pipe(
      // Step 1: Validate request body using io-ts
      validateCodec(TokenRequestCodec, req.body),

      // Step 2: Process based on grant type (discriminated union)
      E.chainW((tokenRequest):
      E.Either<AppError, {type: 'auth_code', grant:AuthCodeGrant} | { type: 'refresh_token', grant: RefreshTokenGrant}> => {
        if (tokenRequest.grant_type === 'authorization_code') {
          // Validate as auth code grant
          return pipe(
            validateCodec(AuthCodeGrantCodec, tokenRequest),
            E.map((grant) => ({ type: 'auth_code' as const, grant }))
          )
        } else if (tokenRequest.grant_type === 'refresh_token') {
          // Validate as refresh token grant
          return pipe(
            validateCodec(RefreshTokenGrantCodec, tokenRequest),
            E.map((grant) => ({ type: 'refresh_token' as const, grant }))
          )
        } else {
          return E.left({
            _tag: 'InvalidGrant' as const,
            reason: `Unsupported grant_type: ${(tokenRequest as any).grant_type}`,
          })
        }
      }),

      // Step 3: Execute business logic based on grant type
      TE.fromEither,
      TE.chainW((request) => {
        if (request.type === 'auth_code') {
          return processAuthCodeGrant(request.grant)(env)
        } else {
          return processRefreshTokenGrant(request.grant)(env)
        }
      })
    )()

    // Step 4: Handle result and send response
    pipe(
      result,
      E.fold(
        // Left: Error occurred
        (error) => {
          const { status, body } = mapErrorToOAuth2(error)
          env.logger.error('Token endpoint error', { error, status, body })
          res.status(status).json(body)
        },
        // Right: Success
        (tokenResponse) => {
          env.logger.info('Token endpoint success', tokenResponse)
          res.json(tokenResponse)
        }
      )
    )
  }
}

/**
 * Router factory (will be used when we have env available)
 */
export const createTokenRouter = (env: AppEnvironment) => {
  router.post('/token', createTokenHandler(env))
  return router
}

export default router
