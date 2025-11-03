/**
 * Functional application entry point
 * Uses fp-ts based routes with dependency injection
 */
import express from 'express'
import { v4 } from 'uuid'
import { NextFunction, Response, Request } from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import session from 'express-session'
import { OAuth2Client } from 'google-auth-library'
import favicon from 'serve-favicon'
import { dirname } from 'path'

// Existing infrastructure
import pool from './pool.js'
import redis from './setup/redis.js'
import hydraAdmin from './setup/hydra.js'
import { PgStore, appConfig } from './config.js'
import jsonLogger from './logging.js'
import { requestLogger } from './middleware/requestLogger.js'
import proxyMiddleware from './setup/proxy.js'

// Functional core
import { createAppLayer } from './fp/bootstrap.js'

// Functional routes
import { createLoginRouter } from './routes/login-fp.js'
import { createLogoutRouter } from './routes/logout-fp.js'
import { createConsentRouter } from './routes/consent-fp.js'
import { createCallbackRouter } from './routes/callback-fp.js'
import { createTokenRouter } from './routes/passthrough-auth-fp.js'

// Legacy route (for non-functional endpoints)
import routes from './routes/index.js'

const app = express()
const __dirname = import.meta.dirname

// Create Google OAuth2 client
const googleClient = new OAuth2Client({
  clientId: appConfig.googleClientId,
  clientSecret: appConfig.googleClientSecret,
  redirectUri: appConfig.middlewareRedirectUri,
})

// Bootstrap functional environment with Effect Layers
const serviceLayer = createAppLayer(redis, hydraAdmin, jsonLogger, {
  googleClientId: appConfig.googleClientId || '',
  googleClientSecret: appConfig.googleClientSecret || '',
})

// Create config objects for routes
const consentConfig = {
  googleClientId: appConfig.googleClientId || '',
  middlewareRedirectUri: appConfig.middlewareRedirectUri,
}

const callbackConfig = {
  middlewareRedirectUri: appConfig.middlewareRedirectUri,
}

const logoutConfig = {
  hostName: appConfig.hostName,
}

// Middleware setup (same as original)
app.set('trust proxy', 1)
app.use(requestLogger)
app.use(
  session({
    store: new PgStore({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    proxy: true,
  })
)

app.use('/oauth2/auth', proxyMiddleware)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser(process.env.SECRETS_SYSTEM || 'G6KaOf8aJsLagw566he8yxOTTO3tInKD'))

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')
app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')))
app.use(express.static(path.join(dirname(import.meta.url), 'public')))

function addUniqueToken(req: Request, res: Response, next: Function) {
  req.headers['x-bondlink-id'] = v4()
  next()
}
app.use(addUniqueToken)

// Routes - using functional versions
app.use('/', routes) // Keep legacy root route for now

// Functional routes with Effect Layer injection
app.use('/login', createLoginRouter(serviceLayer))
app.use('/logout', createLogoutRouter(serviceLayer, logoutConfig))
app.use('/consent', createConsentRouter(serviceLayer, consentConfig))
app.use('/callback', createCallbackRouter(serviceLayer, googleClient, callbackConfig))
app.use('/oauth2', createTokenRouter(serviceLayer))

// Error handlers (same as original)
app.use((req, res, next) => {
  jsonLogger.warn('404 in app-fp.ts', { url: req.originalUrl })
  next(new Error(`Generic Not Found ${req.originalUrl}`))
})

if (app.get('env') === 'development') {
  app.use((err: Error, req: Request, res: Response) => {
    res.status(500)
    res.render('error', {
      message: err.message || 'Empty Message',
      error: err,
    })
  })
}

app.use((err: Error, req: Request, res: Response) => {
  res.status(500)
  res.render('error', {
    message: err.message || 'Empty Message',
    error: {},
  })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  jsonLogger.error('ApplicationError', { stack: err.stack })
  res.status(500).render('error', {
    message: JSON.stringify(err),
  })
})

const listenOn = Number(process.env.PORT || 3000)
app.listen(listenOn, () => {
  jsonLogger.info(`Functional app listening on http://0.0.0.0:${listenOn}`)
})

export default app
