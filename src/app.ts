// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
//import 'source-map-support/register'

import express from "express"
import { NextFunction, Response, Request } from "express"
import path from "path"
import cookieParser from "cookie-parser"
import bodyParser, { json } from "body-parser"
import session from "express-session"
import redis from "./setup/redis.js"
import routes from "./routes/index.js"
import login from "./routes/login.js"
import logout from "./routes/logout.js"
import consent from "./routes/consent.js"
import device from "./routes/device.js"
import callback from "./routes/callback.js"
import testClient from "./routes/test-client.js"
import claude from "./routes/claude.js"
import pool from "./pool.js"
import {PgStore, STATIC_CSRF} from "./config.js"
import jsonLogger from "./logging.js"
import { dirname } from 'path';
import favicon from "serve-favicon";

import { requestLogger } from "./middleware/requestLogger.js";
const __dirname = import.meta.dirname
const app = express()
import {createProxyMiddleware} from "http-proxy-middleware"

const proxyOptions = {
  target: process.env.HYDRA_PUBLIC_URL,
  changeOrigin: true,
  logger:jsonLogger,
  pathRewrite: (path: string, req: Request) => {
    jsonLogger.info("in rewrite", {p:path})
    const parsed = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
    if (parsed.pathname == "/oauth2/auth") {
      const {
        client_id,
        redirect_uri,
        state,
        code_challenge,        // From Claude - YOU will validate this
        code_challenge_method,
        scope
      } = req.query;
      if (code_challenge != undefined && state != undefined) {
        const sessionId = crypto.randomUUID();

        redis.set(`pkce_session:${sessionId}`, JSON.stringify({
          code_challenge,
          code_challenge_method,
          client_id,
          redirect_uri,
          scope,
          state,
          timestamp: Date.now()
        }));
      }
      const queryString = new URLSearchParams(parsed.searchParams.toString());
      queryString.delete("code_challenge")
      queryString.delete("code_challenge_method")
      const returnPath = [parsed.pathname,queryString].join("/")
      jsonLogger.info("Return string", {full:returnPath})
      return returnPath
      }
    }
    // proxyReq.session.state = parsed.searchParams.get("state") || "StateNotFound"
    // proxyReq.session.codeVerifier = parsed.searchParams.get("code_challenge") || "ChallengeNotFound"
    // jsonLogger.info("proxy request", {state:proxyReq.session.state,challenge:proxyReq.session.codeVerifier})
}

app.set('trust proxy', 1)
app.use(requestLogger)
//This is required before body parser
app.use("/oauth2", createProxyMiddleware(proxyOptions))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// Session middleware with PostgreSQL store
app.use(
  session({
    store: new PgStore({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    proxy: true
  })
)

app.use(cookieParser(process.env.SECRETS_SYSTEM || "G6KaOf8aJsLagw566he8yxOTTO3tInKD"));

// view engine setup
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")
app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')));

app.use(express.static(path.join(dirname(import.meta.url), "public")))
//import {v4} from 'uuid';
// function addUniqueToken(req:Request, res:Response, next:Function) {
//   req.headers["x-bondlink-id"] = v4(); // Generate a unique ID and attach it to the request object
//   next(); // Pass control to the next middleware or route handler
// }
// app.use(addUniqueToken)
// const csrfHeader = (req:Request, res:Response, next:Function) => {
//     const token = generateCsrfToken(req, res)
//     jsonLogger.info("Setting csrf-token", {token: token})
//     req.headers["x-csrf-token"] = token
//   // You could also pass the token into the context of a HTML response.
//   next()
// };
app.use("/", routes)
app.use("/test-client", testClient)

// app.use(doubleCsrfProtection)

app.use("/login", login)
app.use("/logout", logout)
app.use("/consent", consent)
//app.use("/device", device)
app.use("/callback", callback)
app.use("/oauth2", claude)



// catch 404 and forward to error handler
app.use((req, res, next) => {
  jsonLogger.warn("404 in app.ts", {url: req.originalUrl})
  next(new Error("Generic Not Found `{req.originalUrl}`" ))
})

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use((err: Error, req: Request, res: Response) => {
    res.status(500)
    res.render("error", {
      message: err.message,
      error: err,
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use((err: Error, req: Request, res: Response) => {
  res.status(500)
  res.render("error", {
    message: err.message,
    error: {},
  })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  jsonLogger.error("ApplicationError", {stack: err.stack})
  res.status(500).render("error", {
    message: JSON.stringify(err),
  })
})

const listenOn = Number(process.env.PORT || 3000)
app.listen(listenOn, () => {
  jsonLogger.debug(`Listening on http://0.0.0.0:${listenOn}`)
})
