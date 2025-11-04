/**
 * Bootstrap the functional environment using Effect Layers
 * Creates all services with proper dependency injection
 */
import { Configuration } from '@ory/hydra-client-fetch'
import { OAuth2Api } from '@ory/hydra-client-fetch/dist/index.js'
import { Layer, Effect, Context } from 'effect'
import { OAuth2ApiServiceLive, type OAuth2ApiConfig } from '../api/oauth2.js'
import { GoogleOAuthServiceLive } from './services/google.js'
import { HydraServiceLive } from './services/hydra.js'
import { RedisServiceLive } from './services/redis.js'
import { Logger } from './services/token.js'
import type { Redis } from 'ioredis'

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
  oauth2Config: OAuth2ApiConfig,
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
  const oauth2ApiLayer = OAuth2ApiServiceLive(oauth2Config)
  const loggerLayer = createLoggerLayer(tsLogger)

  // Create legacy HydraService for routes that still use it
  const configuration = new Configuration({
    basePath: oauth2Config.basePath,
    headers: oauth2Config.headers,
  })
  const hydraClient = new OAuth2Api(configuration)
  const hydraLayer = HydraServiceLive(hydraClient)

  // Merge all service layers
  return Layer.mergeAll(redisLayer, googleLayer, oauth2ApiLayer, hydraLayer, loggerLayer)
}
