/**
 * Application error types using Algebraic Data Types (ADTs)
 * Each error is a discriminated union for exhaustive pattern matching
 */

/**
 * Redis operation errors
 */
export type RedisError =
  | { _tag: 'RedisConnectionError'; message: string }
  | { _tag: 'RedisKeyNotFound'; key: string }
  | { _tag: 'RedisParseError'; key: string; raw: string; error: unknown }
  | { _tag: 'RedisWriteError'; key: string; error: unknown }
  | { _tag: 'RedisDeleteError'; key: string; error: unknown }

/**
 * HTTP client errors
 */
export type HttpError =
  | { _tag: 'NetworkError'; message: string; cause?: unknown }
  | { _tag: 'HttpStatusError'; status: number; statusText: string; body?: unknown }
  | { _tag: 'TimeoutError'; timeoutMs: number }
  | { _tag: 'ParseError'; message: string; raw?: string }

/**
 * OAuth2/PKCE validation errors
 */
export type OAuthError =
  | { _tag: 'InvalidPKCE'; challenge: string; verifier: string; method: string }
  | { _tag: 'InvalidGrant'; reason: string }
  | { _tag: 'InvalidScope'; requested: string[]; granted: string[] }
  | { _tag: 'InvalidClient'; clientId: string }
  | { _tag: 'MissingParameter'; parameter: string }
  | { _tag: 'ExpiredToken'; tokenType: 'auth_code' | 'refresh_token' }

/**
 * Google OAuth errors
 */
export type GoogleOAuthError =
  | { _tag: 'GoogleAuthError'; error: string; errorDescription?: string }
  | { _tag: 'GoogleTokenExpired'; refreshToken: string }
  | { _tag: 'GoogleTokenRevoked'; refreshToken: string }

/**
 * Session errors
 */
export type SessionError =
  | { _tag: 'SessionNotFound'; sessionId: string }
  | { _tag: 'SessionExpired'; sessionId: string }
  | { _tag: 'SessionStorageError'; error: unknown }

/**
 * Validation errors
 */
export type ValidationError =
  | { _tag: 'CodecValidationError'; errors: string[]; value: unknown }
  | { _tag: 'RequiredFieldMissing'; field: string }
  | { _tag: 'InvalidFormat'; field: string; expected: string; received: unknown }

/**
 * Application-level errors (union of all domain errors)
 */
export type AppError =
  | RedisError
  | HttpError
  | OAuthError
  | GoogleOAuthError
  | SessionError
  | ValidationError

/**
 * Error constructors for cleaner error creation
 */
export const RedisError = {
  connectionError: (message: string): RedisError => ({
    _tag: 'RedisConnectionError',
    message,
  }),
  keyNotFound: (key: string): RedisError => ({
    _tag: 'RedisKeyNotFound',
    key,
  }),
  parseError: (key: string, raw: string, error: unknown): RedisError => ({
    _tag: 'RedisParseError',
    key,
    raw,
    error,
  }),
  writeError: (key: string, error: unknown): RedisError => ({
    _tag: 'RedisWriteError',
    key,
    error,
  }),
  deleteError: (key: string, error: unknown): RedisError => ({
    _tag: 'RedisDeleteError',
    key,
    error,
  }),
}

export const HttpError = {
  network: (message: string, cause?: unknown): HttpError => ({
    _tag: 'NetworkError',
    message,
    cause,
  }),
  status: (status: number, statusText: string, body?: unknown): HttpError => ({
    _tag: 'HttpStatusError',
    status,
    statusText,
    body,
  }),
  timeout: (timeoutMs: number): HttpError => ({
    _tag: 'TimeoutError',
    timeoutMs,
  }),
  parse: (message: string, raw?: string): HttpError => ({
    _tag: 'ParseError',
    message,
    raw,
  }),
}

export const OAuthError = {
  invalidPKCE: (challenge: string, verifier: string, method: string): OAuthError => ({
    _tag: 'InvalidPKCE',
    challenge,
    verifier,
    method,
  }),
  invalidGrant: (reason: string): OAuthError => ({
    _tag: 'InvalidGrant',
    reason,
  }),
  invalidScope: (requested: string[], granted: string[]): OAuthError => ({
    _tag: 'InvalidScope',
    requested,
    granted,
  }),
  invalidClient: (clientId: string): OAuthError => ({
    _tag: 'InvalidClient',
    clientId,
  }),
  missingParameter: (parameter: string): OAuthError => ({
    _tag: 'MissingParameter',
    parameter,
  }),
  expiredToken: (tokenType: 'auth_code' | 'refresh_token'): OAuthError => ({
    _tag: 'ExpiredToken',
    tokenType,
  }),
}

export const GoogleOAuthError = {
  authError: (error: string, errorDescription?: string): GoogleOAuthError => ({
    _tag: 'GoogleAuthError',
    error,
    errorDescription,
  }),
  tokenExpired: (refreshToken: string): GoogleOAuthError => ({
    _tag: 'GoogleTokenExpired',
    refreshToken,
  }),
  tokenRevoked: (refreshToken: string): GoogleOAuthError => ({
    _tag: 'GoogleTokenRevoked',
    refreshToken,
  }),
}

export const ValidationError = {
  codecError: (errors: string[], value: unknown): ValidationError => ({
    _tag: 'CodecValidationError',
    errors,
    value,
  }),
  requiredField: (field: string): ValidationError => ({
    _tag: 'RequiredFieldMissing',
    field,
  }),
  invalidFormat: (field: string, expected: string, received: unknown): ValidationError => ({
    _tag: 'InvalidFormat',
    field,
    expected,
    received,
  }),
}
