import { Effect, Layer, Context } from 'effect'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OAuth2ApiService } from '../api/oauth2.js'
import {
  createAppLayer,
  createLoggerAdapter,
  createLoggerLayer,
} from './bootstrap.js'
import { GoogleOAuthService } from './services/google.js'
import { HydraService } from './services/hydra.js'
import { RedisService } from './services/redis.js'
import { Logger } from './services/token.js'
import type { Redis } from 'ioredis'

// Mock Redis client
const createMockRedis = (): Redis => {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    quit: vi.fn(),
  } as unknown as Redis
}

// Mock tslog logger
const createMockTsLogger = () => ({
  silly: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
})

describe('bootstrap', () => {
  let mockRedis: Redis
  let mockTsLogger: ReturnType<typeof createMockTsLogger>

  beforeEach(() => {
    mockRedis = createMockRedis()
    mockTsLogger = createMockTsLogger()
  })

  describe('createLoggerAdapter', () => {
    it('should create logger adapter from tslog instance', async () => {
      const adapter = createLoggerAdapter(mockTsLogger)

      await Effect.runPromise(adapter.info('test message'))
      expect(mockTsLogger.info).toHaveBeenCalledWith('test message', undefined)

      await Effect.runPromise(adapter.error('error message', { code: 500 }))
      expect(mockTsLogger.error).toHaveBeenCalledWith('error message', { code: 500 })

      await Effect.runPromise(adapter.silly('silly message'))
      expect(mockTsLogger.silly).toHaveBeenCalledWith('silly message', undefined)
    })

    it('should wrap logging operations in Effect', async () => {
      const adapter = createLoggerAdapter(mockTsLogger)

      const program = Effect.gen(function* () {
        yield* adapter.info('Starting operation')
        yield* adapter.error('Operation failed')
        return 'done'
      })

      const result = await Effect.runPromise(program)
      expect(result).toBe('done')
      expect(mockTsLogger.info).toHaveBeenCalledTimes(1)
      expect(mockTsLogger.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('createLoggerLayer', () => {
    it('should create valid Logger Layer', async () => {
      const loggerLayer = createLoggerLayer(mockTsLogger)

      const program = Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.info('Test message from layer')
        return 'success'
      })

      const result = await Effect.runPromise(
        Effect.provide(program, loggerLayer)
      )

      expect(result).toBe('success')
      expect(mockTsLogger.info).toHaveBeenCalledWith('Test message from layer', undefined)
    })
  })

  describe('createAppLayer', () => {
    const mockOAuth2Config = {
      basePath: 'https://hydra.example.com',
      headers: { 'X-Test': 'test' },
    }

    const mockGoogleConfig = {
      googleClientId: 'test-client-id',
      googleClientSecret: 'test-client-secret',
    }

    it('should create complete app layer with all services', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      expect(appLayer).toBeDefined()
      expect(Layer.isLayer(appLayer)).toBe(true)
    })

    it('should provide RedisService in the layer', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      vi.mocked(mockRedis.get).mockResolvedValue('test-value')

      const program = Effect.gen(function* () {
        const redis = yield* RedisService
        const value = yield* redis.get('test-key')
        return value
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(result).toBe('test-value')
    })

    it('should provide GoogleOAuthService in the layer', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      const program = Effect.gen(function* () {
        const google = yield* GoogleOAuthService
        return google
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(result).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.getUserInfo).toBeDefined()
    })

    it('should provide HydraService in the layer', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      const program = Effect.gen(function* () {
        const hydra = yield* HydraService
        return hydra
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(result).toBeDefined()
      expect(result.getLoginRequest).toBeDefined()
      expect(result.acceptLoginRequest).toBeDefined()
      expect(result.getConsentRequest).toBeDefined()
    })

    it('should provide OAuth2ApiService in the layer', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      const program = Effect.gen(function* () {
        const oauth2 = yield* OAuth2ApiService
        return oauth2
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(result).toBeDefined()
      expect(result.getLoginRequest).toBeDefined()
      expect(result.acceptLoginRequest).toBeDefined()
    })

    it('should provide Logger in the layer', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      const program = Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.info('Integration test')
        return 'logged'
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(result).toBe('logged')
      expect(mockTsLogger.info).toHaveBeenCalledWith('Integration test', undefined)
    })

    it('should allow services to work together', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      vi.mocked(mockRedis.set).mockResolvedValue('OK' as any)
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify({ test: 'data' }))

      const program = Effect.gen(function* () {
        const redis = yield* RedisService
        const logger = yield* Logger

        yield* logger.info('Storing data in Redis')
        yield* redis.set('integration-test', 'test-value')

        yield* logger.info('Retrieving data from Redis')
        const value = yield* redis.get('integration-test')

        return value
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(mockTsLogger.info).toHaveBeenCalledTimes(2)
      expect(mockRedis.set).toHaveBeenCalled()
      expect(mockRedis.get).toHaveBeenCalled()
    })

    it('should use provided OAuth2 config for HydraService', async () => {
      const customConfig = {
        basePath: 'https://custom-hydra.example.com:4445',
        headers: { 'X-Custom-Header': 'custom-value' },
      }

      const appLayer = createAppLayer(
        mockRedis,
        customConfig,
        mockTsLogger,
        mockGoogleConfig
      )

      const program = Effect.gen(function* () {
        const oauth2 = yield* OAuth2ApiService
        return oauth2
      })

      // Should not throw
      await Effect.runPromise(Effect.provide(program, appLayer))
    })

    it('should handle multiple concurrent service operations', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        mockOAuth2Config,
        mockTsLogger,
        mockGoogleConfig
      )

      vi.mocked(mockRedis.get).mockResolvedValue('value-1')
      vi.mocked(mockRedis.set).mockResolvedValue('OK' as any)

      const program = Effect.gen(function* () {
        const redis = yield* RedisService
        const logger = yield* Logger

        // Run multiple operations concurrently
        const [getValue, setResult] = yield* Effect.all([
          redis.get('key-1'),
          redis.set('key-2', 'value-2'),
        ])

        yield* logger.info('Operations completed')

        return { getValue, setResult }
      })

      const result = await Effect.runPromise(Effect.provide(program, appLayer))

      expect(result.getValue).toBe('value-1')
      expect(result.setResult).toBe('OK')
      expect(mockTsLogger.info).toHaveBeenCalled()
    })
  })

  describe('Layer composition', () => {
    it('should create composable layers', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        { basePath: 'https://hydra.example.com', headers: {} },
        mockTsLogger,
        {
          googleClientId: 'client-id',
          googleClientSecret: 'client-secret',
        }
      )
      class CustomServiceTag extends Context.Tag("CustomService")<
        CustomServiceTag,
        { customMethod: () => 'custom-value' }
      >() {}
      // Create a custom layer that depends on app services
      const customLayer = Layer.succeed(
        CustomServiceTag,
        { customMethod: () => 'custom-value' }
      )

      const combinedLayer = Layer.merge(appLayer, customLayer)

      const program = Effect.gen(function* () {
        const redis = yield* RedisService
        const logger = yield* Logger
        return { redis, logger }
      })

      const result = await Effect.runPromise(
        Effect.provide(program, combinedLayer)
      )

      expect(result.redis).toBeDefined()
      expect(result.logger).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('should propagate Redis errors through the layer', async () => {
      const appLayer = createAppLayer(
        mockRedis,
        { basePath: 'https://hydra.example.com', headers: {} },
        mockTsLogger,
        {
          googleClientId: 'client-id',
          googleClientSecret: 'client-secret',
        }
      )

      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'))

      const program = Effect.gen(function* () {
        const redis = yield* RedisService
        return yield* redis.get('test-key')
      })

      const result = await Effect.runPromise(
        Effect.either(Effect.provide(program, appLayer))
      )

      expect(result._tag).toBe('Left')
    })
  })
})
