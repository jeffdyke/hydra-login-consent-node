// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import session from "express-session"
import connectPgSimple from "connect-pg-simple"
import pool from "./pool.js"

import { doubleCsrf, SameSiteType } from "csrf-csrf";
import jsonLogger from "./logging.js";
const httpOnly = !process.env.BASE_URL?.startsWith("https")
const XSRF_TOKEN_NAME = !process.env.BASE_URL?.startsWith("https") ? 'dev_xsrf_token' : 'xsrf_token'
const CLAUDE_CLIENT_ID = process.env.CLAUDE_CLIENT_ID || ""
interface AppConfigI {
  csrfTokenName: string,
  hostName: string
  middlewareRedirectUri: string
  sameSite: SameSiteType
  httpOnly: boolean
  secure: boolean
  googleClientId?: string
  googleClientSecret?: string
  claudeRedirectUri: string

}

class DevAppConfig implements AppConfigI {
  csrfTokenName: string = "dev_xsrf_token"
  hostName: string = "http://dev.bondlin.org:3000"
  middlewareRedirectUri: string = "http://dev.bondlin.org:3000/callback"
  sameSite: SameSiteType = "lax"
  httpOnly: boolean = true
  secure: boolean = false
  googleClientId?: string | undefined = undefined
  googleClientSecret?: string | undefined = undefined
  claudeRedirectUri: string = "https://claude.ai/api/mcp/auth_callback"
}

class StagingAppConfig implements AppConfigI {
  csrfTokenName: string = "xsrf_token"
  hostName: string = "http://auth.staging.bondlink.org"
  middlewareRedirectUri: string = "https://auth.staging.bondlink.org/callback"
  sameSite: SameSiteType = "none"
  httpOnly: boolean = false
  secure: boolean = true
  googleClientId?: string | undefined = process.env.GOOGLE_CLIENT_ID;
  googleClientSecret?: string | undefined = process.env.GOOGLE_CLIENT_SECRET
  claudeRedirectUri: string = "https://claude.ai/api/mcp/auth_callback"

}
// class ProdAppConfig implements AppConfigI {
//   csrfTokenName: string = "xsrf_token"
//   hostName: string = "http://auth.staging.bondlink.org"
//   middlewareRedirectUri: string = "http://auth.staging.bondlink.org/callback"
//   sameSite: SameSiteType = "none"
//   httpOnly: boolean = false
//   secure: boolean = true
//   googleClientId?: string | undefined = process.env.GOOGLE_CLIENT_ID;
//   googleClientSecret?: string | undefined = process.env.GOOGLE_CLIENT_SECRET
//   claudeRedirectUri: string = "https://claude.ai/api/mcp/auth_callback"

// }
const appConfig = (httpOnly) ? new DevAppConfig() : new StagingAppConfig()

// CookieOptions is an interface, this is currently unused
const lclCookieOptions = {
  httpOnly:httpOnly,
  secure:!httpOnly,
  // domain:"bondlink.org",
  maxAge:30 * 24 * 60 * 60 * 1000,
  sameSite:httpOnly ? "lax" : "none"
}
jsonLogger.info("Cookie Options", lclCookieOptions)

// function csrfToken(req:Request, res:Response) {
// }
// const {
//   doubleCsrfProtection, // The middleware to protect routes
//   generateCsrfToken,        // Helper function to generate a CSRF token
// } = doubleCsrf({
//   getSecret: () => "G6KaOf8aJsLagw566he8yxOTTO3tInKD",
//   cookieName: appConfig.csrfTokenName,
//   cookieOptions: {
//     sameSite: appConfig.sameSite,
//     httpOnly: appConfig.httpOnly,
//     secure: appConfig.secure,
//     // domain: "bondlink.org",
//     maxAge: 30 * 24 * 60 * 60 * 1000,
//   },
//   getSessionIdentifier: (req) => {
//     return req.session.id
//   },
// });
const STATIC_CSRF = "YOU-ARE-USING-THE-STATIC-CSRF"
const generateCsrfToken = (req:any, res:any) => STATIC_CSRF

const pgConfig = {
  user: process.env.POSTGRES_USER || "hydra",
  password: process.env.POSTGRES_PASSWORD || "shaken!stirred",
  database: process.env.POSTGRES_DB || "hydra",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
}

const PgStore = connectPgSimple(session)
// function hasClientId() {
//   let s = "select * from hydra_client where id = $1"
//   const res = pool.query(s, [CLIENT_ID]);
//   return res
// }
function dumpSessionData() {
  try {
    const result = pool.query('SELECT * FROM session');
    jsonLogger.info('Session data:', {session:result});
    return result;
  } catch (err) {
    jsonLogger.error('Error fetching session data: %s', err);
    throw err;
  }
}

export {
  pgConfig,
  // doubleCsrfProtection,
  generateCsrfToken,
  CLAUDE_CLIENT_ID,
  STATIC_CSRF,
  PgStore,
  httpOnly,
  dumpSessionData,
  XSRF_TOKEN_NAME,
  appConfig
}
