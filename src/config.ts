import session from "express-session"
import connectPgSimple from "connect-pg-simple"
import pool from "./pool.js"
import { SameSiteType } from "csrf-csrf";
import jsonLogger from "./logging.js";
const httpOnly = !process.env.BASE_URL?.startsWith("https")
const DCR_MASTER_CLIENT_ID = process.env.DCR_MASTER_CLIENT_ID || ""
interface AppConfigI {
  csrfTokenName: string,
  hostName: string
  middlewareRedirectUri: string
  sameSite: SameSiteType
  httpOnly: boolean
  secure: boolean
  googleClientId?: string
  googleClientSecret?: string
  dcrOriginRedirectUri: string
  hydraInternalAdmin: string
  hydraInternalUrl: string
  redisHost: string
  redisPort: number
  xsrfHeaderName: string

}

/**
 * These should take into account the docker container and not send over the network
 */
class DevAppConfig implements AppConfigI {
  csrfTokenName: string = "dev_xsrf_token"
  hostName: string = "http://dev.bondlin.org:3000"
  middlewareRedirectUri: string = "http://dev.bondlin.org:3000/callback"
  hydraInternalUrl: string = "http://dev.bondlink.org:4444"
  hydraInternalAdmin: string = "http://dev.bondlink.org:4445"
  sameSite: SameSiteType = "lax"
  httpOnly: boolean = true
  redisHost: string = "dev.bondlink.org"
  redisPort: number = 6379
  secure: boolean = false
  googleClientId?: string | undefined = undefined
  googleClientSecret?: string | undefined = undefined
  dcrOriginRedirectUri: string = "https://claude.ai/api/mcp/auth_callback"
  xsrfHeaderName: string = "dev_xsrf_token"
}

class StagingAppConfig implements AppConfigI {
  csrfTokenName: string = "xsrf_token"
  hostName: string = "http://auth.staging.bondlink.org"
  middlewareRedirectUri: string = "https://auth.staging.bondlink.org/callback"
  hydraInternalUrl: string = "http://10.1.1.230:4444"
  hydraInternalAdmin: string = "http://10.1.1.230:4445"
  redisHost: string = "10.1.1.230"
  redisPort: number = 16379
  sameSite: SameSiteType = "none"
  httpOnly: boolean = false
  secure: boolean = true
  googleClientId?: string | undefined = process.env.GOOGLE_CLIENT_ID;
  googleClientSecret?: string | undefined = process.env.GOOGLE_CLIENT_SECRET
  dcrOriginRedirectUri: string = "https://claude.ai/api/mcp/auth_callback"
  xsrfHeaderName: string = "xsrf_token"

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
//   dcrOriginRedirectUri: string = "https://claude.ai/api/mcp/auth_callback"

// }
const appConfig = (httpOnly) ? new DevAppConfig() : new StagingAppConfig()

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
const HYDRA_URL = process.env.HYDRA_URL
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
  DCR_MASTER_CLIENT_ID,
  STATIC_CSRF,
  PgStore,
  httpOnly,
  dumpSessionData,
  appConfig,
  HYDRA_URL
}
