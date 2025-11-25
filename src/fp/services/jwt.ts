/**
 * JWT Service using Effect and jose
 * Generates and verifies JWTs for OAuth2 token responses
 */
import { Effect, Context, Layer } from 'effect'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import crypto from 'crypto'
import { ParseError, type AppError } from '../errors.js'
import { syncLogger } from '../../logging-effect.js'
import { sync } from 'effect/Deferred'

/**
 * JWT Claims structure
 */
export interface JWTClaims extends JWTPayload {
  sub: string // Subject (user ID)
  scope: string // Space-separated scopes
  client_id: string // OAuth2 client ID
  jti: string // JWT ID (unique identifier for this token)
  iat: number // Issued at
  exp: number // Expiration time
}

/**
 * JWT Service interface
 */
export interface JWTService {
  /**
   * Sign a JWT with the given claims
   */
  readonly sign: (
    claims: Omit<JWTClaims, 'iat' | 'exp'>,
    expiresIn: number // Expiration in seconds
  ) => Effect.Effect<string, AppError>

  /**
   * Verify and decode a JWT
   */
  readonly verify: (token: string) => Effect.Effect<JWTClaims, AppError>

  /**
   * Generate a unique JWT ID
   */
  readonly generateJti: () => Effect.Effect<string>
}

/**
 * JWT Service tag
 */
export const JWTService = Context.GenericTag<JWTService>('JWTService')

/**
 * JWT Service configuration
 */
export interface JWTConfig {
  secret: string // Secret key for signing JWTs
  issuer: string // Token issuer (usually the application URL)
  audience: string // Token audience (usually the client application)
}

/**
 * Create JWT Service implementation
 */
export const makeJWTService = (config: JWTConfig): JWTService => {
  const secret = new TextEncoder().encode(config.secret)
  syncLogger.info('JWT Service initialized', { config: { ...config} })
  return {
    sign: (claims, expiresIn) =>
      Effect.tryPromise({
        try: async () => {
          syncLogger.debug('Signing JWT', { claims, expiresIn, config })
          const now = Math.floor(Date.now() / 1000)

          const jwt = await new SignJWT({
            ...claims,
            iat: now,
            exp: now + expiresIn,
          })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuer(config.issuer)
            .setAudience(config.audience)
            .sign(secret)

          return jwt
        },
        catch: (error) =>
          new ParseError({
            message: `Failed to sign JWT: ${String(error)}`,
          }),
      }),

    verify: (token) =>
      Effect.tryPromise({
        try: async () => {
          const { payload } = await jwtVerify(token, secret, {
            issuer: config.issuer,
            audience: config.audience,
          })

          // Validate required claims
          if (!payload.sub || !payload.jti || !payload.client_id) {
            throw new Error('Missing required claims in JWT')
          }

          return payload as JWTClaims
        },
        catch: (error) =>
          new ParseError({
            message: `Failed to verify JWT: ${String(error)}`,
          }),
      }),

    generateJti: () =>
      Effect.sync(() => crypto.randomBytes(16).toString('base64url')),
  }
}

/**
 * Create a Layer for JWTService
 */
export const JWTServiceLive = (config: JWTConfig) =>
  Layer.succeed(JWTService, makeJWTService(config))
