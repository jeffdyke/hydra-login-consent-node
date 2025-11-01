/**
 * Example of how to integrate the functional token endpoint into the existing app
 */
import express from 'express'
import redis from '../setup/redis.js'
import jsonLogger from '../logging.js'
import { createAppEnvironment } from './bootstrap.js'
import { createTokenRouter } from '../routes/passthrough-auth-fp.js'

/**
 * Example: Bootstrap the functional environment and mount the router
 *
 * You can either:
 * 1. Replace the existing /oauth2 router entirely
 * 2. Mount at a different path (e.g., /oauth2/v2) for parallel testing
 * 3. Use a feature flag to switch between implementations
 */
export const setupFunctionalTokenEndpoint = (app: express.Application) => {
  // Create the functional environment from existing infrastructure
  const env = createAppEnvironment(
    redis,
    jsonLogger,
    {
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      hydraUrl: process.env.HYDRA_URL || 'http://localhost:4445',
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    }
  )

  // Option 1: Replace the existing route
  // app.use('/oauth2', createTokenRouter(env))

  // Option 2: Mount at a new path for testing
  app.use('/oauth2/fp', createTokenRouter(env))

  // Option 3: Feature flag
  const useFunctionalVersion = process.env.USE_FP_TOKEN_ENDPOINT === 'true'
  if (useFunctionalVersion) {
    app.use('/oauth2', createTokenRouter(env))
  } else {
    // Use the existing imperative version
    const passthroughAuth = await import('../routes/passthrough-auth.js')
    app.use('/oauth2', passthroughAuth.default)
  }
}

/**
 * Example: Direct usage in app.ts
 *
 * In src/app.ts, you would add:
 *
 * ```typescript
 * import { setupFunctionalTokenEndpoint } from './fp/example-integration.js'
 *
 * // ... existing middleware setup ...
 *
 * setupFunctionalTokenEndpoint(app)
 *
 * // ... rest of app setup ...
 * ```
 */

/**
 * Example: Testing the functional endpoint
 */
export const testFunctionalEndpoint = async () => {
  // Create a test environment with mock services
  const testRedis = {
    get: async (key: string) => null,
    set: async () => 'OK' as const,
    del: async () => 1,
    exists: async () => 0,
  }

  const testLogger = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
    silly: console.log,
  }

  const testConfig = {
    googleClientId: 'test-client-id',
    googleClientSecret: 'test-secret',
    hydraUrl: 'http://localhost:4445',
    redisHost: 'localhost',
    redisPort: 6379,
  }

  // You can create a test environment and test business logic
  // without making real HTTP calls or Redis connections
}
