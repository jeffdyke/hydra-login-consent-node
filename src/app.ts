// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
//import 'source-map-support/register'

import express from "express"
import { NextFunction, Response, Request } from "express"
import path from "path"
import cookieParser from "cookie-parser"
import bodyParser from "body-parser"
import session from "express-session"
import connectPgSimple from "connect-pg-simple"

import routes from "./routes/index.js"
import login from "./routes/login.js"
import logout from "./routes/logout.js"
import consent from "./routes/consent.js"
import device from "./routes/device.js"
import callback from "./routes/callback.js"
import { pgConfig, hasClientId } from "./config.js"
import jsonLogger from "./logging.js"
import { dirname } from 'path';
import favicon from "serve-favicon";
import { default as csurf } from 'csurf';
import { requestLogger } from "./middleware/requestLogger.js";

const app = express()
app.use(requestLogger)
const PgStore = connectPgSimple(session)
const __dirname = import.meta.dirname;
let exists = hasClientId()
if (!exists) {
  throw new Error("clientId returned false, this is required, query failed")
} else {
  jsonLogger.info("ClientId %s", JSON.stringify(exists))
}
// view engine setup
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")
jsonLogger.info("View path: %s", path.join(__dirname, "views"))
// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')));

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
// Sets up csrf protection
const csrfProtection = csurf({
  cookie: {
    sameSite: "lax",
  },
})

// app.use(csrfProtection);
// Session middleware with PostgreSQL store
app.use(
  session({
    store: new PgStore({
      conObject: pgConfig,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  })
)

app.use(express.static(path.join(dirname(import.meta.url), "public")))

app.use("/", routes)
app.use("/login", login)
app.use("/logout", logout)
app.use("/consent", consent)
app.use("/device", device)
app.use("/callback", callback)

app.use((req, res, next) => {
  req.on('data', () => {

    jsonLogger.info('request: %s', JSON.stringify(req));
    jsonLogger.info("body: %s", JSON.stringify(req.body))
  })
  // res.on('finish', () => {
  //   jsonLogger.info('response: %s', JSON.stringify(res));

  // });
  next();
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  jsonLogger.info("404 Not Found: %s", req.originalUrl)
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
  jsonLogger.error("ApplicationError: %s", JSON.stringify(err.stack))
  res.status(500).render("error", {
    message: JSON.stringify(err),
  })
})

const listenOn = Number(process.env.PORT || 3000)
app.listen(listenOn, () => {
  jsonLogger.debug(`Listening on http://0.0.0.0:${listenOn}`)
})
