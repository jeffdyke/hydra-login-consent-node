/**
 * Redis service using Effect for all side effects
 * All Redis operations return Effect<Result, RedisError>
 */
import { Effect, pipe, Context, Layer } from 'effect'
import {
  RedisConnectionError,
  RedisKeyNotFound,
  RedisParseError,
  RedisWriteError,
  RedisDeleteError,
  type RedisError,
  SchemaValidationError} from '../errors.js'
import { validateSchema } from '../validation.js'
import type { Schema} from 'effect';
import type { Redis } from 'ioredis'

/**
 * Redis service interface
 */
export interface RedisService {
  readonly get: (key: string) => Effect.Effect<string | null, RedisError>
  readonly getJSON: <A, I>(
    key: string,
    schema: Schema.Schema<A, I, never>
  ) => Effect.Effect<A, RedisError | SchemaValidationError>
  readonly set: (
    key: string,
    value: string,
    expireSeconds?: number
  ) => Effect.Effect<'OK', RedisError>
  readonly setJSON: (
    key: string,
    value: unknown,
    expireSeconds?: number
  ) => Effect.Effect<'OK', RedisError>
  readonly del: (...keys: string[]) => Effect.Effect<number, RedisError>
  readonly exists: (...keys: string[]) => Effect.Effect<number, RedisError>
}

/**
 * Redis service tag for dependency injection
 */
export const RedisService = Context.GenericTag<RedisService>('RedisService')

/**
 * Create a RedisService implementation from an ioredis client
 */
export const makeRedisService = (client: Redis): RedisService => ({
  get: (key: string) =>
    Effect.tryPromise({
      try: () => client.get(key),
      catch: (error) =>
        new RedisConnectionError({ message: `Failed to get key ${key}: ${error}` }),
    }),

  getJSON: <A, I>(key: string, schema: Schema.Schema<A, I, never>): Effect.Effect<A, RedisError | SchemaValidationError> =>
    pipe(
      Effect.tryPromise({
        try: () => client.get(key),
        catch: (error) =>
          new RedisConnectionError({ message: `Failed to get key ${key}: ${error}` }),
      }),
      Effect.flatMap((raw): Effect.Effect<unknown, RedisError> => {
        if (raw === null) {
          return Effect.fail(new RedisKeyNotFound({ key }))
        }
        return Effect.try({
          try: () => JSON.parse(raw),
          catch: (error) => new RedisParseError({ key, raw, error }),
        })
      }),
      Effect.flatMap((parsed) => validateSchema(schema, parsed))
    ),

  set: (key: string, value: string, expireSeconds?: number) =>
    Effect.tryPromise({
      try: async () => {
        if (expireSeconds) {
          return await client.set(key, value, 'EX', expireSeconds)
        }
        return await client.set(key, value)
      },
      catch: (error) => new RedisWriteError({ key, error }),
    }),

  setJSON: (key: string, value: unknown, expireSeconds?: number) =>
    pipe(
      Effect.try({
        try: () => JSON.stringify(value),
        catch: (error) => new RedisWriteError({ key, error }),
      }),
      Effect.flatMap((jsonString) =>
        Effect.tryPromise({
          try: async () => {
            if (expireSeconds) {
              return await client.set(key, jsonString, 'EX', expireSeconds)
            }
            return await client.set(key, jsonString)
          },
          catch: (error) => new RedisWriteError({ key, error }),
        })
      )
    ),

  del: (...keys: string[]) =>
    Effect.tryPromise({
      try: () => client.del(...keys),
      catch: (error) => new RedisDeleteError({ key: keys.join(', '), error }),
    }),

  exists: (...keys: string[]) =>
    Effect.tryPromise({
      try: () => client.exists(...keys),
      catch: (error) =>
        new RedisConnectionError({ message: `Failed to check existence: ${error}` }),
    }),
})

/**
 * Create a Layer for the RedisService
 */
export const RedisServiceLive = (client: Redis) =>
  Layer.succeed(RedisService, makeRedisService(client))

/**
 * Specialized Redis operations for OAuth2/PKCE data
 */
export const createOAuthRedisOps = (service: RedisService) => {
  const PKCE_PREFIX = 'pkce_session:'
  const AUTH_CODE_PREFIX = 'auth_code:'
  const AUTH_CODE_STATE_PREFIX = 'auth_code_state:'
  const REFRESH_TOKEN_PREFIX = 'refresh_token:'

  return {
    getPKCEState: <A, I>(sessionId: string, schema: Schema.Schema<A, I, never>) =>
      service.getJSON(`${PKCE_PREFIX}${sessionId}`, schema),

    setPKCEState: (sessionId: string, state: unknown, ttlSeconds?: number) =>
      service.setJSON(`${PKCE_PREFIX}${sessionId}`, state, ttlSeconds),

    deletePKCEState: (sessionId: string) =>
      service.del(`${PKCE_PREFIX}${sessionId}`),

    getAuthCode: <A, I>(code: string, schema: Schema.Schema<A, I, never>) =>
      service.getJSON(`${AUTH_CODE_PREFIX}${code}`, schema),

    setAuthCode: (code: string, data: unknown, ttlSeconds: number = 300) =>
      service.setJSON(`${AUTH_CODE_PREFIX}${code}`, data, ttlSeconds),

    deleteAuthCode: (code: string) => service.del(`${AUTH_CODE_PREFIX}${code}`),

    getAuthCodeState: <A, I>(code: string, schema: Schema.Schema<A, I, never>) =>
      service.getJSON(`${AUTH_CODE_STATE_PREFIX}${code}`, schema),

    setAuthCodeState: (code: string, state: unknown, ttlSeconds: number = 300) =>
      service.setJSON(`${AUTH_CODE_STATE_PREFIX}${code}`, state, ttlSeconds),

    deleteAuthCodeState: (code: string) =>
      service.del(`${AUTH_CODE_STATE_PREFIX}${code}`),

    getRefreshToken: <A, I>(refreshToken: string, schema: Schema.Schema<A, I, never>) =>
      service.getJSON(`${REFRESH_TOKEN_PREFIX}${refreshToken}`, schema),

    setRefreshToken: (
      refreshToken: string,
      data: unknown,
      ttlSeconds: number = 60 * 60 * 24 * 30
    ) => service.setJSON(`${REFRESH_TOKEN_PREFIX}${refreshToken}`, data, ttlSeconds),

    deleteRefreshToken: (refreshToken: string) =>
      service.del(`${REFRESH_TOKEN_PREFIX}${refreshToken}`),
  }
}
