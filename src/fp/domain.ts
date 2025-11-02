/**
 * Domain types with io-ts codecs for runtime validation
 * Using io-ts provides both compile-time types and runtime validation
 */
import * as t from 'io-ts'
import { DateFromISOString } from 'io-ts-types'

/**
 * PKCE Challenge Method
 */
export const PKCEMethodCodec = t.union([
  t.literal('S256'),
  t.literal('plain'),
])
export type PKCEMethod = t.TypeOf<typeof PKCEMethodCodec>

/**
 * PKCE State stored in Redis
 */
export const PKCEStateCodec = t.type({
  code_challenge: t.string,
  code_challenge_method: PKCEMethodCodec,
  scope: t.string,
  state: t.string,
  redirect_uri: t.string,
  client_id: t.string,
  timestamp: t.number,
})
export type PKCEState = t.TypeOf<typeof PKCEStateCodec>

/**
 * OAuth2 Grant Types
 */
export const GrantTypeCodec = t.union([
  t.literal('authorization_code'),
  t.literal('refresh_token'),
])
export type GrantType = t.TypeOf<typeof GrantTypeCodec>

/**
 * Authorization Code Grant Request
 */
export const AuthCodeGrantCodec = t.type({
  grant_type: t.literal('authorization_code'),
  code: t.string,
  code_verifier: t.string,
  redirect_uri: t.string,
  client_id: t.string,
})
export type AuthCodeGrant = t.TypeOf<typeof AuthCodeGrantCodec>

/**
 * Refresh Token Grant Request
 */
export const RefreshTokenGrantCodec = t.type({
  grant_type: t.literal('refresh_token'),
  refresh_token: t.string,
  client_id: t.string,
  scope: t.union([t.string, t.undefined]),
})
export type RefreshTokenGrant = t.TypeOf<typeof RefreshTokenGrantCodec>

/**
 * Token Request (discriminated union)
 */
export const TokenRequestCodec = t.union([
  AuthCodeGrantCodec,
  RefreshTokenGrantCodec,
])
export type TokenRequest = t.TypeOf<typeof TokenRequestCodec>

/**
 * Google Token Response
 */
export const GoogleTokenResponseCodec = t.type({
  access_token: t.string,
  expires_in: t.number,
  scope: t.string,
  token_type: t.string,
  id_token: t.union([t.string, t.undefined]),
  refresh_token: t.union([t.string, t.undefined]),
})
export type GoogleTokenResponse = t.TypeOf<typeof GoogleTokenResponseCodec>

/**
 * Google Error Response
 */
export const GoogleErrorResponseCodec = t.type({
  error: t.string,
  error_description: t.union([t.string, t.undefined]),
})
export type GoogleErrorResponse = t.TypeOf<typeof GoogleErrorResponseCodec>

/**
 * Refresh Token Data stored in Redis
 */
export const RefreshTokenDataCodec = t.type({
  client_id: t.string,
  refresh_token: t.string,
  access_token: t.string,
  scope: t.string,
  subject: t.string,
  created_at: t.number,
  expires_in: t.number,
  updated_at: t.union([t.number, t.undefined]),
})
export type RefreshTokenData = t.TypeOf<typeof RefreshTokenDataCodec>

/**
 * Auth Code Data stored in Redis
 */
export const AuthCodeDataCodec = t.type({
  google_tokens: t.type({
    tokens: GoogleTokenResponseCodec,
  }),
  subject: t.union([t.string, t.undefined]),
})
export type AuthCodeData = t.TypeOf<typeof AuthCodeDataCodec>

/**
 * OAuth2 Token Response (what we return to clients)
 */
export const OAuth2TokenResponseCodec = t.type({
  access_token: t.string,
  token_type: t.literal('Bearer'),
  expires_in: t.number,
  refresh_token: t.string,
  scope: t.string,
})
export type OAuth2TokenResponse = t.TypeOf<typeof OAuth2TokenResponseCodec>

/**
 * OAuth2 Error Response
 */
export const OAuth2ErrorResponseCodec = t.type({
  error: t.string,
  error_description: t.union([t.string, t.undefined]),
})
export type OAuth2ErrorResponse = t.TypeOf<typeof OAuth2ErrorResponseCodec>

/**
 * Helper to create OAuth2 error responses
 */
export const createOAuth2Error = (
  error: string,
  errorDescription?: string
): OAuth2ErrorResponse => ({
  error,
  error_description: errorDescription,
})
