// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import express from "express"
import crypto from "crypto"
import jsonLogger from "../logging.js"
import {generateCsrfToken, CLAUDE_CLIENT_ID, appConfig} from "../config.js"
import url from "url"

import axios from "../middleware/axios.js"
import {CLIENT_ID, hydraAdmin} from "../setup/hydra.js"
import { newClient } from "../authFlow.js"
import { googleAuthUrl } from "../google_auth.js"
import { json } from "body-parser"
const router = express.Router()

interface ParseAuthRequest {
  codeChallenge:string,
  scope:string,
  clientId:string,
  redirectUri:string,
  state:string,
  responseType:string
}


const HYDRA_URL = process.env.HYDRA_URL || ""
jsonLogger.info("environment", {hydraUrl:HYDRA_URL, redirect:appConfig.redirectUri})
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
function authPost(data:ParseAuthRequest): URL {
  const authUrl = new URL(`${HYDRA_URL}/oauth2/auth`)
  jsonLogger.info("authUrl", authUrl)
  authUrl.searchParams.append("client_id", data.clientId)
  authUrl.searchParams.append("redirect_uri", data.redirectUri)
  authUrl.searchParams.append("response_type", data.responseType)
  authUrl.searchParams.append("scope", data.scope)
  authUrl.searchParams.append("state", data.state)
  authUrl.searchParams.append("code_challenge", data.codeChallenge)
  authUrl.searchParams.append("code_challenge_method", "S256")
  return authUrl
}
router.head('/', (req, res) => {
  res.set('X-BondLink-Special', 'Head-Only-Value');
  res.status(204).end();
});
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
  }
  // Build authorization URL
  const postData: ParseAuthRequest = {
    clientId:CLIENT_ID,
    scope: "openid offline",
    redirectUri:appConfig.redirectUri,
    state:state,
    codeChallenge:codeChallenge,
    responseType: "code"
  }

  jsonLogger.info("Auth request - Index", {request:postData})
  // Redirect to Hydra for authorization
  res.redirect(authPost(postData).toString())
})

router.post("/", (req, res) => {
  /**
   * Create a new client, will need to dedupe later
   * Authenticate to google with middle redirect
   * capture google response
   */

  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl
  const parsed = new URL(fullUrl)
  const internalPost: ParseAuthRequest = {
    codeChallenge: parsed.searchParams.get("code_challenge") || "",
    scope: "openid offline",
    redirectUri: appConfig.redirectUri,
    state:parsed.searchParams.get("state") || "",
    clientId:parsed.searchParams.get("client_id") || "",
    responseType:parsed.searchParams.get("response_type") || "",
  }

  jsonLogger.info("Calling local post endpoint", {post:internalPost})
  newClient(CLAUDE_CLIENT_ID).then(client => {
    jsonLogger.info("new client created", {c:client})
    googleAuthUrl(internalPost.scope, req.session.state || "").then(authUrl => {
      jsonLogger.info("redirecting to google", {url:authUrl})
      res.redirect(authUrl)
    }).catch(err => {
      jsonLogger.warn("caught error trying to redirect to authUrl", {e: err})
      return err
    })

  })

  // axios.post(authPost(internalPost).toString()).then(resultLocal => {
  //   jsonLogger.info("ResultLog from internal post", {result: resultLocal})
  //   const reqData: ParseAuthRequest = {
  //     codeChallenge: parsed.searchParams.get("code_challenge") || "",
  //     scope: "openid offline email",
  //     clientId:parsed.searchParams.get("client_id") || "",
  //     redirectUri:parsed.searchParams.get("redirect_uri") || "",
  //     state:parsed.searchParams.get("state") || "",
  //     responseType:parsed.searchParams.get("response_type") || ""

  //   }
    // const postData = authPost(reqData)
    // res.redirect(postData.toString())
  //})







})

export default router
