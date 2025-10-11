// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import express, { NextFunction, Response, Request } from "express"
import path from "path"
import logger from "morgan"
import cookieParser from "cookie-parser"
import bodyParser from "body-parser"
import session from "express-session"
import connectPgSimple from "connect-pg-simple"
import { google as gapi} from "googleapis"

import routes from "./routes"
import login from "./routes/login"
import logout from "./routes/logout"
import consent from "./routes/consent"
import device from "./routes/device"
import callback from "./routes/callback"
import { pgConfig } from "./config"

const favicon = require('serve-favicon');
const app = express()
const PgStore = connectPgSimple(session)
// const keys = require()

// //On load, called to load the auth2 library and API client library.


// // Initialize the API client library
// function initClient() {
//   new gapi.auth.OAuth2(
//     process.env.CLIENT_ID,
//     process.env.CLIENT_SECRET,
//     process.env.REDIRECT_URI
//   )
//   gapi.client.init({
//     discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
//     clientId: 'YOUR_CLIENT_ID',
//     scope: 'https://www.googleapis.com/auth/drive.metadata.readonly'
//   }).then(function () {
//     // do stuff with loaded APIs
//     console.log('it worked');
//   });
// }

// view engine setup
app.set("views", path.join(__dirname, "..", "views"))
app.set("view engine", "pug")

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

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
  }),
)

app.use(express.static(path.join(__dirname, "public")))

app.use("/", routes)
app.use("/login", login)
app.use("/logout", logout)
app.use("/consent", consent)
app.use("/device", device)
app.use("/callback", callback)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(new Error("Generic Not Found"))
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
  console.error(err.stack)
  res.status(500).render("error", {
    message: JSON.stringify(err, null, 2),
  })
})

const listenOn = Number(process.env.PORT || 3000)
app.listen(listenOn, () => {
  console.log(`Listening on http://0.0.0.0:${listenOn}`)
})
