/**
 * Redis service using TaskEither for all side effects
 * All Redis operations return TaskEither<RedisError, Result>
 */
import * as TE from 'fp-ts/TaskEither'
import * as E from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import type { Redis } from 'ioredis'
import { RedisError, ValidationError } from '../errors.js'
import { validateCodec } from '../validation.js'
import * as t from 'io-ts'

/**
 * Redis operations wrapped in TaskEither
 */
export interface RedisService {
  /**
   * Get a value from Redis by key
   */
  get: (key: string) => TE.TaskEither<RedisError, string | null>

  /**
   * Get and parse JSON from Redis with codec validation
   */
  getJSON: <C extends t.Mixed>(
    key: string,
    codec: C
  ) => TE.TaskEither<RedisError | ValidationError, t.TypeOf<C>>

  /**
   * Set a value in Redis
   */
  set: (
    key: string,
    value: string,
    expiryMode?: 'EX' | 'PX',
    time?: number
  ) => TE.TaskEither<RedisError, 'OK'>

  /**
   * Set a JSON value in Redis
   */
  setJSON: (
    key: string,
    value: unknown,
    expiryMode?: 'EX' | 'PX',
    time?: number
  ) => TE.TaskEither<RedisError, 'OK'>

  /**
   * Delete a key from Redis
   */
  del: (...keys: string[]) => TE.TaskEither<RedisError, number>

  /**
   * Check if a key exists
   */
  exists: (...keys: string[]) => TE.TaskEither<RedisError, number>
}

/**
 * Create a RedisService from an ioredis client
 */
export const createRedisService = (client: Redis): RedisService => {
  /**
   * Helper to wrap Redis operations in TaskEither
   */
  const wrapRedisOp = <A>(
    operation: () => Promise<A>,
    errorConstructor: (error: unknown) => RedisError
  ): TE.TaskEither<RedisError, A> =>
    TE.tryCatch(operation, errorConstructor)

  return {
    get: (key: string) =>
      wrapRedisOp(
        () => client.get(key),
        (error) => RedisError.connectionError(`Failed to get key ${key}: ${error}`)
      ),

    getJSON: <C extends t.Mixed>(key: string, codec: C) =>
      pipe(
        wrapRedisOp(
          () => client.get(key),
          (error) => RedisError.connectionError(`Failed to get key ${key}: ${error}`)
        ),
        TE.chainW((raw) => {
          if (raw === null) {
            return TE.left(RedisError.keyNotFound(key))
          }
          try {
            const parsed = JSON.parse(raw)
            return pipe(
              validateCodec(codec, parsed),
              E.mapLeft((validationError) => validationError as RedisError | ValidationError),
              TE.fromEither
            )
          } catch (error) {
            return TE.left(RedisError.parseError(key, raw, error))
          }
        })
      ),

    set: (key: string, value: string, expiryMode?: 'EX' | 'PX', time?: number) =>
      wrapRedisOp(
        () => {
          if (expiryMode && time) {
            return client.set(key, value, expiryMode, time)
          }
          return client.set(key, value)
        },
        (error) => RedisError.writeError(key, error)
      ),

    setJSON: (key: string, value: unknown, expiryMode?: 'EX' | 'PX', time?: number) =>
      pipe(
        TE.tryCatch(
          () => Promise.resolve(JSON.stringify(value)),
          (error) => RedisError.writeError(key, error)
        ),
        TE.chainW((jsonString) =>
          wrapRedisOp(
            () => {
              if (expiryMode && time) {
                return client.set(key, jsonString, expiryMode, time)
              }
              return client.set(key, jsonString)
            },
            (error) => RedisError.writeError(key, error)
          )
        )
      ),

    del: (...keys: string[]) =>
      wrapRedisOp(
        () => client.del(...keys),
        (error) => RedisError.deleteError(keys.join(', '), error)
      ),

    exists: (...keys: string[]) =>
      wrapRedisOp(
        () => client.exists(...keys),
        (error) => RedisError.connectionError(`Failed to check existence: ${error}`)
      ),
  }
}

/**
 * Specialized Redis operations for OAuth2/PKCE data
 */
export const createOAuthRedisOps = (service: RedisService) => {
  const PKCE_PREFIX = 'pkce_session:'
  const AUTH_CODE_PREFIX = 'auth_code:'
  const AUTH_CODE_STATE_PREFIX = 'auth_code_state:'
  const REFRESH_TOKEN_PREFIX = 'refresh_token:'

  return {
    /**
     * Get PKCE state by session ID
     */
    getPKCEState: <C extends t.Mixed>(sessionId: string, codec: C) =>
      service.getJSON(`${PKCE_PREFIX}${sessionId}`, codec),

    /**
     * Store PKCE state
     */
    setPKCEState: (sessionId: string, state: unknown, ttlSeconds?: number) =>
      service.setJSON(`${PKCE_PREFIX}${sessionId}`, state, 'EX', ttlSeconds),

    /**
     * Delete PKCE state
     */
    deletePKCEState: (sessionId: string) =>
      service.del(`${PKCE_PREFIX}${sessionId}`),

    /**
     * Get auth code data
     */
    getAuthCode: <C extends t.Mixed>(code: string, codec: C) =>
      service.getJSON(`${AUTH_CODE_PREFIX}${code}`, codec),

    /**
     * Store auth code data
     */
    setAuthCode: (code: string, data: unknown, ttlSeconds: number = 300) =>
      service.setJSON(`${AUTH_CODE_PREFIX}${code}`, data, 'EX', ttlSeconds),

    /**
     * Delete auth code (one-time use)
     */
    deleteAuthCode: (code: string) =>
      service.del(`${AUTH_CODE_PREFIX}${code}`),

    /**
     * Get auth code state
     */
    getAuthCodeState: <C extends t.Mixed>(code: string, codec: C) =>
      service.getJSON(`${AUTH_CODE_STATE_PREFIX}${code}`, codec),

    /**
     * Store auth code state
     */
    setAuthCodeState: (code: string, state: unknown, ttlSeconds: number = 300) =>
      service.setJSON(`${AUTH_CODE_STATE_PREFIX}${code}`, state, 'EX', ttlSeconds),

    /**
     * Delete auth code state
     */
    deleteAuthCodeState: (code: string) =>
      service.del(`${AUTH_CODE_STATE_PREFIX}${code}`),

    /**
     * Get refresh token data
     */
    getRefreshToken: <C extends t.Mixed>(refreshToken: string, codec: C) =>
      service.getJSON(`${REFRESH_TOKEN_PREFIX}${refreshToken}`, codec),

    /**
     * Store refresh token data (30 day TTL)
     */
    setRefreshToken: (refreshToken: string, data: unknown, ttlSeconds: number = 60 * 60 * 24 * 30) =>
      service.setJSON(`${REFRESH_TOKEN_PREFIX}${refreshToken}`, data, 'EX', ttlSeconds),

    /**
     * Delete refresh token
     */
    deleteRefreshToken: (refreshToken: string) =>
      service.del(`${REFRESH_TOKEN_PREFIX}${refreshToken}`),
  }
}
