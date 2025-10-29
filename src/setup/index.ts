import { doubleCsrf } from "csrf-csrf";
import express from "express";

const XSRF_TOKEN_NAME = !process.env.BASE_URL?.startsWith("https") ? 'dev_xsrf_token' : 'xsrf_token'
const httpOnly = !process.env.BASE_URL?.startsWith("https")

const {
  doubleCsrfProtection, // The middleware to protect routes
  generateCsrfToken,        // Helper function to generate a CSRF token
} = doubleCsrf({
  getSecret: () => "G6KaOf8aJsLagw566he8yxOTTO3tInKD",
  cookieName: XSRF_TOKEN_NAME,
  cookieOptions: {
    sameSite: 'none', // Secure cookie settings
    httpOnly: httpOnly,
    secure: !httpOnly,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
  getSessionIdentifier: (req) => {
    return req.session.id
  },
});

interface RedisPKCE {
  code_challenge:string
  code_challenge_method:string
  scope: string
  state: string
  redirect_uri: string
  client_id: string
  timestamp:number
}


export {generateCsrfToken, RedisPKCE}

// const configureCSRF = (app: express.Application) => {
//   app.use(doubleCsrfProtection);
//   app.use((req, res, next) => {
//     res.locals.csrfToken = generateCsrfToken(req, res);
//     next();
//   });
// };


// export {configureCSRF}
