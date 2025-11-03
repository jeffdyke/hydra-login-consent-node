/**
 * Bootstrap the functional environment using Effect Layers
 * Creates all services with proper dependency injection
 */
import { Layer, Effect, Context } from 'effect'
import { Redis } from 'ioredis'
import type { OAuth2Api } from '@ory/hydra-client-fetch/dist/index.js'
import { RedisServiceLive } from './services/redis.js'
import { GoogleOAuthServiceLive } from './services/google.js'
import { HydraServiceLive } from './services/hydra.js'
import { Logger } from './services/token.js'

/**
 * Configuration interface
 */
export interface AppConfig {
  googleClientId: string
  googleClientSecret: string
  hydraUrl: string
  redisHost: string
  redisPort: number
  middlewareRedirectUri: string
  hostName: string
}

/**
 * Adapter to wrap tslog Logger into our Logger interface
 */
export const createLoggerAdapter = (tsLogger: any): Logger => ({
  silly: (message: string, meta?: object) =>
    Effect.sync(() => tsLogger.silly(message, meta)),
  info: (message: string, meta?: object) =>
    Effect.sync(() => tsLogger.info(message, meta)),
  error: (message: string, meta?: object) =>
    Effect.sync(() => tsLogger.error(message, meta)),
})

/**
 * Create Logger Layer from tslog instance
 */
export const createLoggerLayer = (tsLogger: any) =>
  Layer.succeed(Logger, createLoggerAdapter(tsLogger))

/**
 * Create the complete application service layer from existing infrastructure
 */
export const createAppLayer = (
  redisClient: Redis,
  hydraClient: OAuth2Api,
  tsLogger: any,
  config: {
    googleClientId: string
    googleClientSecret: string
  }
) => {
  const redisLayer = RedisServiceLive(redisClient)
  const googleLayer = GoogleOAuthServiceLive({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
  })
  const hydraLayer = HydraServiceLive(hydraClient)
  const loggerLayer = createLoggerLayer(tsLogger)

  // Merge all service layers
  return Layer.mergeAll(redisLayer, googleLayer, hydraLayer, loggerLayer)
}
