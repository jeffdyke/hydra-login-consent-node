// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { Configuration } from "@ory/hydra-client-fetch";
import { OAuth2Api } from "@ory/hydra-client-fetch/dist/index.js"
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


const baseOptions: any = {}
if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}
const configuration = new Configuration({
  basePath: process.env.HYDRA_ADMIN_URL,
  accessToken: process.env.ORY_API_KEY || process.env.ORY_PAT,
  headers: baseOptions.headers,
})
const CLIENT_ID = process.env.AUTH_FLOW_CLIENT_ID || "633b91cd-550f-4b80-8d01-58a2a786c8da"
if (!CLIENT_ID) {
  throw new Error("CLIENT_ID environment is not legit `{process.env.AUTH_FLOW_CLIENT_ID}`")
}
const hydraAdmin = new OAuth2Api(configuration)

const pgConfig = {
  user: process.env.POSTGRES_USER || "hydra",
  password: process.env.POSTGRES_PASSWORD || "shaken!stirred",
  database: process.env.POSTGRES_DB || "hydra",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
}

const PgStore = connectPgSimple(session)
function hasClientId() {
  let s = "select * from hydra_client where id = $1"
  const res = pool.query(s, [CLIENT_ID]);
  return res
}
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
  hydraAdmin,
  pgConfig,
  CLIENT_ID,
  hasClientId,
  doubleCsrfProtection,
  generateCsrfToken,
  PgStore,
  httpOnly,
  dumpSessionData,
  XSRF_TOKEN_NAME
}
