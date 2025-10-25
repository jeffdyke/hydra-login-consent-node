// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import session from "express-session"
import connectPgSimple from "connect-pg-simple"
import pool from "./pool.js"

import { doubleCsrf } from "csrf-csrf";
import jsonLogger from "./logging.js";
const httpOnly = !process.env.BASE_URL?.startsWith("https")
const XSRF_TOKEN_NAME = !process.env.BASE_URL?.startsWith("https") ? 'dev_xsrf_token' : 'xsrf_token'
// CookieOptions is an interface, this is currently unused
const lclCookieOptions = {
  httpOnly:httpOnly,
  secure:!httpOnly,
  // domain:"bondlink.org",
  maxAge:30 * 24 * 60 * 60 * 1000,
  sameSite:httpOnly ? "lax" : "none"
}
jsonLogger.info("Cookie Options", lclCookieOptions)

const {
  doubleCsrfProtection, // The middleware to protect routes
  generateCsrfToken,        // Helper function to generate a CSRF token
} = doubleCsrf({
  getSecret: () => "G6KaOf8aJsLagw566he8yxOTTO3tInKD",
  cookieName: XSRF_TOKEN_NAME,
  cookieOptions: {
    sameSite:httpOnly ? "lax" : "none",
    httpOnly: httpOnly,
    secure: !httpOnly,
    // domain: "bondlink.org",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
  getSessionIdentifier: (req) => {
    return req.session.id
  },
});


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
  doubleCsrfProtection,
  generateCsrfToken,
  PgStore,
  httpOnly,
  dumpSessionData,
  XSRF_TOKEN_NAME
}
