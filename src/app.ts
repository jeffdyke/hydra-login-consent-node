// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
//import 'source-map-support/register'

import express from "express"
import { NextFunction, Response, Request } from "express"
import path from "path"
import cookieParser from "cookie-parser"
import bodyParser, { json } from "body-parser"
import session from "express-session"

import routes from "./routes/index.js"
import login from "./routes/login.js"
import logout from "./routes/logout.js"
import consent from "./routes/consent.js"
import device from "./routes/device.js"
import callback from "./routes/callback.js"
import pool from "./pool.js"
import { httpOnly, doubleCsrfProtection, PgStore, generateCsrfToken, XSRF_TOKEN } from "./config.js"
import jsonLogger from "./logging.js"
import { dirname } from 'path';
import favicon from "serve-favicon";

import { requestLogger } from "./middleware/requestLogger.js";
const __dirname = import.meta.dirname
const app = express()
app.use(requestLogger)

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
  })
)
app.use(cookieParser(process.env.SECRETS_SYSTEM || "G6KaOf8aJsLagw566he8yxOTTO3tInKD"));

// view engine setup
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")
app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')));

app.use(express.static(path.join(dirname(import.meta.url), "public")))

const csrfHeader = (req:Request, res:Response, next:Function) => {
  if (req.is('application/x-www-form-urlencoded') && req.body[XSRF_TOKEN]) {
    jsonLogger.info("Setting csrf-token", {token: req.body[XSRF_TOKEN]})
    req.headers["x-csrf-token"] = req.body[XSRF_TOKEN]
  }
  // You could also pass the token into the context of a HTML response.
  next()
};
app.use(csrfHeader)
app.use(doubleCsrfProtection)
app.use("/", routes)
app.use("/login", login)
app.use("/logout", logout)
app.use("/consent", consent)
app.use("/device", device)
app.use("/callback", callback)


// catch 404 and forward to error handler
app.use((req, res, next) => {
  jsonLogger.warn("404 in app.ts", {url: req.originalUrl})
  next(new Error("Generic Not Found `{$req.originalUrl}`" ))
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
