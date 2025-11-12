/**
 * Proxy middleware for OAuth2 authorization flow
 * Uses RedisService from fp/services to store PKCE state with proper error handling
 */
import { Effect } from 'effect'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { Redis } from 'ioredis'
import { appConfig } from '../config.js'
import { RedisService, RedisServiceLive, createOAuthRedisOps } from '../fp/services/redis.js'
import jsonLogger from '../logging.js'
import type { PKCEState } from '../fp/domain.js'
import type { Request, Response, NextFunction } from 'express'

// Create Redis client
const redisClient = new Redis({
  host: appConfig.redisHost,
  port: appConfig.redisPort,
})

// Create Redis service layer from the redis client
const redisLayer = RedisServiceLive(redisClient)

const proxyOptions = {
  target: appConfig.hydraInternalUrl,
  changeOrigin: true,
  prependPath: false,
  logger: jsonLogger,
  onProxyReq: (proxyReq: Request, req: Request, res: Response) => {
    const parsed = new URL(`${req.protocol  }://${  req.get('host')  }${req.originalUrl}`)
    if (req.originalUrl.startsWith("/oauth2/register") && req.body && typeof req.body === 'object' && req.body?.contacts === null) {
      // Hydra expects contacts to be an array, not null
      proxyReq.body.contacts = []
    }
  },
  pathRewrite: async (path: string, req: Request) => {
    const parsed = new URL(`${req.protocol  }://${  req.get('host')  }${req.originalUrl}`)
    if (parsed.pathname === '/oauth2/auth') {
      const sessionId = crypto.randomUUID()
      req.session.pkceKey = req.session.pkceKey ?? sessionId

      const {
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        scope,
      } = req.query

      // Only store PKCE state if we have the required parameters
      if (code_challenge !== undefined && state !== undefined) {
        const method = String(code_challenge_method ?? 'S256')
        const pkceData: PKCEState = {
          code_challenge: String(code_challenge),
          code_challenge_method: method === 'plain' ? 'plain' : 'S256',
          scope: String(scope ?? ''),
          state: String(state),
          redirect_uri: String(redirect_uri ?? ''),
          client_id: String(client_id ?? ''),
          timestamp: Date.now(),
        }

        // Store PKCE state in Redis using Effect with RedisService
        const pkceKey = req.session.pkceKey ?? sessionId
        const storePKCE = Effect.gen(function* () {
          const redis = yield* RedisService
          const redisOps = createOAuthRedisOps(redis)
          return yield* redisOps.setPKCEState(
            pkceKey,
            pkceData,
            3600 // 1 hour TTL
          )
        })

        // Provide the Redis layer and run the Effect
        const program = Effect.provide(storePKCE, redisLayer)
        const result = await Effect.runPromise(Effect.either(program))

        if (result._tag === 'Left') {
          // Log non-fatal Redis errors but don't fail the request
          jsonLogger.error('Failed to store PKCE state in Redis', {
            key: `pkce_session:${req.session.pkceKey}`,
            error: result.left,
            pkceData,
          })
          // Continue processing - Redis failure is not fatal for the proxy
        } else {
          jsonLogger.debug('PKCE state stored successfully', {
            key: `pkce_session:${req.session.pkceKey}`,
          })
        }
      }

      // Rewrite the query string
      const queryString = new URLSearchParams(parsed.searchParams.toString())
      queryString.delete('code_challenge')
      queryString.delete('code_challenge_method')
      queryString.set('state', req.session.id)

      const returnPath = [parsed.pathname, queryString].join('?')
      jsonLogger.info('Proxy complete: Sending to Hydra, session ID is set to be state', {
        sessionId: req.session.id,
        pkceKey: req.session.pkceKey,
      })

      return returnPath
    }

    // Return original path if not /oauth2/auth
    return path
  },
}

/**
 * Enhanced proxy middleware with validation
 * Validates required OAuth2 parameters and returns 400 for fatal errors
 */
const enhancedProxyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/oauth2/auth') {
    const { client_id, redirect_uri, response_type } = req.query

    // Fatal validation errors that should return 400
    const missingParams: string[] = []

    if (!client_id) missingParams.push('client_id')
    if (!redirect_uri) missingParams.push('redirect_uri')
    if (!response_type) missingParams.push('response_type')

    if (missingParams.length > 0) {
      jsonLogger.error('Missing required OAuth2 parameters', {
        missingParams,
        query: req.query,
      })
      return res.status(400).json({
        error: 'invalid_request',
        error_description: `Missing required parameters: ${missingParams.join(', ')}`,
      })
    }

    // Validate response_type
    if (response_type !== 'code') {
      jsonLogger.error('Invalid response_type', {
        response_type,
        query: req.query,
      })
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported',
      })
    }
  }

  // Continue to proxy
  next()
}

// Export the middleware with validation wrapper
export default [enhancedProxyMiddleware, createProxyMiddleware(proxyOptions)]
