/**
 * Google OAuth service using TaskEither for HTTP operations
 * All external calls return TaskEither for proper error handling
 */
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'
import axios, { AxiosError } from 'axios'
import { HttpError, GoogleOAuthError } from '../errors.js'
import {
  GoogleTokenResponse,
  GoogleTokenResponseCodec,
  GoogleErrorResponseCodec,
  RefreshTokenData,
} from '../domain.js'
import { validateCodec } from '../validation.js'

/**
 * Google OAuth service interface
 */
export interface GoogleOAuthService {
  /**
   * Refresh Google access token using refresh token
   */
  refreshToken: (
    tokenData: RefreshTokenData
  ) => TE.TaskEither<HttpError | GoogleOAuthError, GoogleTokenResponse>
}

/**
 * Configuration for Google OAuth
 */
export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  tokenEndpoint?: string
}

/**
 * Create Google OAuth service
 */
export const createGoogleOAuthService = (
  config: GoogleOAuthConfig
): GoogleOAuthService => {
  const TOKEN_ENDPOINT = config.tokenEndpoint || 'https://oauth2.googleapis.com/token'

  /**
   * Helper to handle axios errors
   */
  const handleAxiosError = (error: unknown): HttpError | GoogleOAuthError => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError

      // Try to parse Google error response
      if (axiosError.response?.data) {
        const errorResult = validateCodec(
          GoogleErrorResponseCodec,
          axiosError.response.data
        )

        if (errorResult._tag === 'Right') {
          return GoogleOAuthError.authError(
            errorResult.right.error,
            errorResult.right.error_description
          )
        }
      }

      // Generic HTTP error
      return HttpError.status(
        axiosError.response?.status || 500,
        axiosError.response?.statusText || 'Unknown error',
        axiosError.response?.data
      )
    }

    // Network or unknown error
    return HttpError.network('Network error during Google OAuth request', error)
  }

  return {
    refreshToken: (tokenData: RefreshTokenData) =>
      pipe(
        TE.tryCatch(
          async () => {
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
          handleAxiosError
        ),
        TE.chainW((data) =>
          pipe(
            validateCodec(GoogleTokenResponseCodec, data),
            TE.fromEither,
            TE.mapLeft((validationError) =>
              HttpError.parse(
                `Failed to parse Google token response: ${JSON.stringify(validationError)}`
              )
            )
          )
        )
      ),
  }
}
