/**
 * Bootstrap the functional environment
 * Creates all services with proper dependency injection
 */
import { Redis } from 'ioredis'
import type { OAuth2Api } from '@ory/hydra-client-fetch/dist/index.js'
import { createRedisService } from './services/redis.js'
import { createGoogleOAuthService } from './services/google.js'
import { createHydraService } from './services/hydra.js'
import { AppEnvironment, Logger, AppConfig } from './environment.js'

/**
 * Adapter to wrap tslog Logger into our Logger interface
 */
export const createLoggerAdapter = (tsLogger: any): Logger => ({
  debug: (message: string, meta?: object) => tsLogger.debug(message, meta),
  info: (message: string, meta?: object) => tsLogger.info(message, meta),
  warn: (message: string, meta?: object) => tsLogger.warn(message, meta),
  error: (message: string, meta?: object) => tsLogger.error(message, meta),
  silly: (message: string, meta?: object) => tsLogger.silly(message, meta),
})

/**
 * Create the complete application environment from existing infrastructure
 */
export const createAppEnvironment = (
  redisClient: Redis,
  hydraClient: OAuth2Api,
  tsLogger: any,
  config: {
    googleClientId: string
    googleClientSecret: string
    hydraUrl: string
    redisHost: string
    redisPort: number
    middlewareRedirectUri: string
    hostName: string
  }
): AppEnvironment => {
  const logger = createLoggerAdapter(tsLogger)

  const appConfig: AppConfig = {
    googleClientId: config.googleClientId,
    googleClientSecret: config.googleClientSecret,
    hydraUrl: config.hydraUrl,
    redisHost: config.redisHost,
    redisPort: config.redisPort,
    middlewareRedirectUri: config.middlewareRedirectUri,
    hostName: config.hostName,
  }

  const redisService = createRedisService(redisClient)

  const googleService = createGoogleOAuthService({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
  })

  const hydraService = createHydraService(hydraClient)

  return {
    redis: redisService,
    google: googleService,
    hydra: hydraService,
    logger,
    config: appConfig,
  }
}
