// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import express from "express"
import crypto from "crypto"
import jsonLogger from "../logging.js"
import {generateCsrfToken, CLAUDE_CLIENT_ID, appConfig} from "../config.js"
import url from "url"
import {CLIENT_ID} from "../setup/hydra.js"
import { getClient } from "../authFlow.js"
import { googleAuthUrl } from "../google_auth.js"
import { Request, Response, NextFunction, RequestHandler } from 'express'
const router = express.Router()
// import {createProxyMiddleware} from "http-proxy-middleware"
// const proxyOptions = {
//   target: process.env.HYDRA_PUBLIC_URL,
//   changeOrigin: true,
//   prependPath: false,
//   logger: console,
//   onProxyReq: (proxyReq:Request, req:Request, res:Response) => {

//     const parsed = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
//     req.session.state = parsed.searchParams.get("state") || "StateNotFound"
//     req.session.codeVerifier = parsed.searchParams.get("code_challenge") || "ChallengeNotFound"
//     console.log("proxy request", {state:proxyReq.session.state,challenge:proxyReq.session.codeVerifier})
//   }
// }
//router.get("/oauth2/auth", createProxyMiddleware(proxyOptions))
//app.use("/oauth2/auth", createProxyMiddleware(proxyOptions))
interface ParseAuthRequest {
  codeChallenge:string,
  scope:string,
  clientId:string,
  redirectUri:string,
  state:string,
  responseType:string
}


const HYDRA_URL = process.env.HYDRA_URL || ""
jsonLogger.info("environment", {hydraUrl:HYDRA_URL, redirect:appConfig.middlewareRedirectUri})
// Helper function to generate base64url encoded string
function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

// Generate PKCE code verifier
function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32))
}

// Generate PKCE code challenge from verifier
function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(crypto.createHash("sha256").update(verifier).digest())
}
function queryToObject(req: Request): any {
  const parsed = url.parse(req.url, true)

}
router.head('/', (req, res) => {
  res.set('X-BondLink-Special', 'Head-Only-Value');
  res.status(204).end();
});


// router.get("/oauth2/auth", async (req, res) => {
//   const parsed = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
//   const { method, headers, body } = req
//   const newHeaders = { ...headers }
//   delete newHeaders.host;
//   jsonLogger.info("Caught request for ouath2/auth", {method:method,body:body})
//   req.session.state = parsed.searchParams.get("state") || "emptyInSession"
//   req.session.codeVerifier = parsed.searchParams.get("code_challenge") || "emptyInSession"
//   try {
//     const response = await axios({
//       method,
//       url: `${process.env.HYDRA_PUBLIC_URL}${req.originalUrl}`,
//       headers: newHeaders,
//       data: body,
//       validateStatus: (status) => true, // Forward all status codes
//     });
//     res.status(response.status).set(response.headers).send(response.data);
//   } catch (error) {
//     jsonLogger.error('Error forwarding request:', error);
//     res.status(500).send('Error forwarding request');
//   }
// })
// router.use((req,res,next) => {
//   let token = generateCsrfToken(req, res)
//   jsonLogger.info("Adding token to request", {token:token, exists:req.headers['x-csrf-token']})
//   req.headers['x-csrf-token'] = token
//   next()
// })
// route / is local testing, /authorize is from claude, the / route is not really needed
// This endpoint is rather useless, needs to be updated after the claude flow is complete
router.get("/", (req, res) => {
  jsonLogger.info("At root for local testing")
  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex")

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Store in session for later verification
  if (req.session) {
    req.session.state = state
    req.session.codeVerifier = codeVerifier
  } else {
    jsonLogger.info("session returned none")
  }
  // Build authorization URL
  const postData: ParseAuthRequest = {
    clientId:CLIENT_ID,
    scope: "openid email profile",
    redirectUri:appConfig.middlewareRedirectUri,
    state:state,
    codeChallenge:codeChallenge,
    responseType: "code"
  }

  jsonLogger.info("Auth request - Index", {request:postData})
  // Redirect to Hydra for authorization

})

router.post("/", async (req, res) => {
  /**
   * Create a new client, will need to dedupe later
   * Authenticate to google with middle redirect
   * capture google response
   */

  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl
  const parsed = new URL(fullUrl)
  const internalPost: ParseAuthRequest = {
    codeChallenge: parsed.searchParams.get("code_challenge") || "",
    scope: "openid profile email offline_access",
    redirectUri: appConfig.middlewareRedirectUri,
    state:parsed.searchParams.get("state") || "",
    clientId:parsed.searchParams.get("client_id") || "",
    responseType:parsed.searchParams.get("response_type") || "",
  }


  const existing = await getClient(CLAUDE_CLIENT_ID).then(c => {
    jsonLogger.info("Client exists", {clientId:CLAUDE_CLIENT_ID})
    let auth = googleAuthUrl(internalPost.scope, req.session.state || "", "https://clau").then(authUrl => {
      jsonLogger.info("redirecting to google", {url:authUrl})
      res.redirect(authUrl)
    }).catch(errA => {
      jsonLogger.info("caught an error creating authUril", {e: errA})
    })
    return auth
  }).catch(err => {
    jsonLogger.info("caught an error fetching client", {e: err})

  })

  return existing
})

export default router
