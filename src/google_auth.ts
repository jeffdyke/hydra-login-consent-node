/**
 * Google Auth service using Effect for OAuth operations
 * Wraps Google OAuth2Client and HTTP operations with proper error handling
 */
import { Effect, Context, Layer, pipe } from 'effect'
import axios, { AxiosError } from 'axios'
import { OAuth2Client } from 'google-auth-library'
import { GoogleUserInfoResponse, GoogleTokenResponse, GoogleTokenResponseSchema, GoogleUserInfoSchema } from './fp/domain.js'
import { HttpError, HttpStatusError, NetworkError, ParseError, GoogleAuthError } from './fp/errors.js'
import { validateSchema } from './fp/validation.js'

/**
 * Google Auth service interface
 * This is a minimal implementation based on current needs, could easily wrap more of the library
 */
export interface GoogleAuthService {
  readonly generateAuthUrl: (
    scope: string,
    state: string,
    redirectUrl: string
  ) => Effect.Effect<string, HttpError>

  readonly getTokensFromCode: (
    code: string,
    redirectUrl: string
  ) => Effect.Effect<GoogleTokenResponse, HttpError | GoogleAuthError>

  readonly refreshAccessToken: (
    refreshToken: string
  ) => Effect.Effect<GoogleTokenResponse, HttpError | GoogleAuthError>

  readonly getUserInfo: (
    accessToken: string,
    idToken: string
  ) => Effect.Effect<GoogleUserInfoResponse, HttpError | GoogleAuthError>
}

export const GoogleAuthService = Context.GenericTag<GoogleAuthService>('GoogleAuthService')

export interface GoogleAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  tokenEndpoint?: string
  userInfoEndpoint?: string
}

export const makeGoogleAuthService = (config: GoogleAuthConfig): GoogleAuthService => {
  const TOKEN_ENDPOINT = config.tokenEndpoint || 'https://oauth2.googleapis.com/token'
  const USER_INFO_ENDPOINT = config.userInfoEndpoint || 'https://www.googleapis.com/oauth2/v2/userinfo'

  const oauth2Client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  })

  /**
   * Helper to handle axios errors
   */
  const handleAxiosError = (error: unknown, operationName: string): HttpError | GoogleAuthError => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError

      if (axiosError.response?.data) {
        try {
          const errorData = axiosError.response.data as any
          if (errorData.error) {
            return new GoogleAuthError({
              error: errorData.error,
              errorDescription: errorData.error_description,
            })
          }
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
      message: `Network error during ${operationName}`,
      cause: error,
    })
  }

  return {
    generateAuthUrl: (scope: string, state: string, redirectUrl: string) =>
      Effect.tryPromise({
        try: async () => {
          const authUri = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scope,
            prompt: 'consent',
            state: state,
            response_type: 'code',
            redirect_uri: redirectUrl,
          })
          return authUri
        },
        catch: (error): HttpError =>
          new NetworkError({
            message: 'Failed to generate Google auth URL',
            cause: error,
          }),
      }),

    getTokensFromCode: (code: string, redirectUrl: string) =>
      pipe(
        Effect.tryPromise({
          try: async () => {
            const response = await oauth2Client.getToken({
              code,
              redirect_uri: redirectUrl,
            })
            return response.tokens
          },
          catch: (error) => handleAxiosError(error, 'getTokensFromCode'),
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

    refreshAccessToken: (refreshToken: string) =>
      pipe(
        Effect.tryPromise({
          try: async () => {
            const response = await axios.post(
              TOKEN_ENDPOINT,
              new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: config.clientId,
                client_secret: config.clientSecret,
              }).toString(),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              }
            )
            return response.data
          },
          catch: (error) => handleAxiosError(error, 'refreshAccessToken'),
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

    getUserInfo: (accessToken: string, idToken: string) =>
      pipe(
        Effect.tryPromise({
          try: async () => {
            const url = `${USER_INFO_ENDPOINT}?alt=json&access_token=${accessToken}`
            const response = await axios.get(url, {
              headers: { Authorization: `Bearer ${idToken}` },
            })
            return response.data
          },
          catch: (error) => handleAxiosError(error, 'getUserInfo'),
        }),
        Effect.flatMap((data) => validateSchema(GoogleUserInfoSchema, data)),
        Effect.mapError(
          (error): HttpError | GoogleAuthError =>
            error._tag === 'SchemaValidationError'
              ? new ParseError({
                  message: `Failed to parse Google user info response: ${error.errors.join(', ')}`,
                })
              : error
        )
      ),
  }
}

/**
 * Create a Layer for GoogleAuthService
 */
export const GoogleAuthServiceLive = (config: GoogleAuthConfig) =>
  Layer.succeed(GoogleAuthService, makeGoogleAuthService(config))
