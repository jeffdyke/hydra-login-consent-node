/**
 * Google OAuth service using Effect for HTTP operations
 * All external calls return Effect for proper error handling
 */
import { Effect, pipe, Context, Layer, Schema } from 'effect'
import axios, { AxiosError } from 'axios'
import { HttpError, NetworkError, HttpStatusError, ParseError, GoogleAuthError } from '../errors.js'
import {
  GoogleTokenResponse,
  GoogleTokenResponseSchema,
  GoogleErrorResponseSchema,
  RefreshTokenData,
} from '../domain.js'
import { validateSchema } from '../validation.js'

/**
 * Google OAuth service interface
 */
export interface GoogleOAuthService {
  readonly refreshToken: (
    tokenData: RefreshTokenData
  ) => Effect.Effect<GoogleTokenResponse, HttpError | GoogleAuthError>
}

/**
 * Google OAuth service tag
 */
export const GoogleOAuthService = Context.GenericTag<GoogleOAuthService>('GoogleOAuthService')

/**
 * Configuration for Google OAuth
 */
export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  tokenEndpoint?: string
}

/**
 * Create Google OAuth service implementation
 */
export const makeGoogleOAuthService = (
  config: GoogleOAuthConfig
): GoogleOAuthService => {
  const TOKEN_ENDPOINT = config.tokenEndpoint || 'https://oauth2.googleapis.com/token'

  return {
    refreshToken: (tokenData: RefreshTokenData) =>
      pipe(
        Effect.tryPromise({
          try: async () => {
            const response = await axios.post(
              TOKEN_ENDPOINT,
              new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: tokenData.google_refresh_token,
                grant_type: 'refresh_token',
              }).toString(),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              }
            )
            return response.data
          },
          catch: (error): HttpError | GoogleAuthError => {
            if (axios.isAxiosError(error)) {
              const axiosError = error as AxiosError

              // Try to parse Google error response
              if (axiosError.response?.data) {
                try {
                  const errorValidation = Schema.decodeUnknownSync(
                    GoogleErrorResponseSchema
                  )(axiosError.response.data)
                  return new GoogleAuthError({
                    error: errorValidation.error,
                    errorDescription: errorValidation.error_description,
                  })
                } catch {
                  // Fall through to generic HTTP error
                }
              }

              // Generic HTTP error
              return new HttpStatusError({
                status: axiosError.response?.status || 500,
                statusText: axiosError.response?.statusText || 'Unknown error',
                body: axiosError.response?.data,
              })
            }

            // Network or unknown error
            return new NetworkError({
              message: 'Network error during Google OAuth request',
              cause: error,
            })
          },
        }),
        Effect.flatMap((data) => validateSchema(GoogleTokenResponseSchema, data)),
        Effect.mapError(
          (error): HttpError | GoogleAuthError =>
            error._tag === 'SchemaValidationError'
              ? new ParseError({
                  message: `Failed to parse Google token response: ${error.errors.join(', ')}`,
                })
              : error
        )
      ),
  }
}

/**
 * Create a Layer for GoogleOAuthService
 */
export const GoogleOAuthServiceLive = (config: GoogleOAuthConfig) =>
  Layer.succeed(GoogleOAuthService, makeGoogleOAuthService(config))
