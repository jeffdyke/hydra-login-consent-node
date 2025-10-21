// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import express from "express"
import crypto from "crypto"
import jsonLogger from "../logging.js"
import {CLIENT_ID, doubleCsrfProtection} from "../config.js"
import url from "url"
const router = express.Router()

interface ParseAuthRequest {
  codeChallenge:string,
  scope:string,
  clientId:string,
  redirectUri:string,
  state:string,
  responseType:string
}
const REDIRECT_URI = process.env.REDIRECT_URL || ""
const HYDRA_URL = process.env.HYDRA_URL || ""

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
  authUrl.searchParams.append("client_id", data.clientId)
  authUrl.searchParams.append("redirect_uri", data.redirectUri)
  authUrl.searchParams.append("response_type", data.responseType)
  authUrl.searchParams.append("scope", data.scope)
  authUrl.searchParams.append("state", data.state)
  authUrl.searchParams.append("code_challenge", data.codeChallenge)
  authUrl.searchParams.append("code_challenge_method", "S256")
  return authUrl
}
// route / is local testing, /authorize is from claude, the / route is not really needed
router.get("/", doubleCsrfProtection, (req, res) => {
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
    redirectUri:REDIRECT_URI,
    state:state,
    codeChallenge:codeChallenge,
    responseType: "code"
  }

  jsonLogger.info("Auth request - Index", {request:postData})
  // Redirect to Hydra for authorization
  res.redirect(authPost(postData).toString())
})

router.get("/authorize", (req, res) => {
  jsonLogger.info("URL", {u:req.url})
  const parsed = new URL(req.url)
  const reqData: ParseAuthRequest ={
    codeChallenge: parsed.searchParams.get("code_challenge") || "",
    scope: parsed.searchParams.get("scope") || "",
    clientId:parsed.searchParams.get("client_id") || "",
    redirectUri:parsed.searchParams.get("redirect_uri") || "",
    state:parsed.searchParams.get("state") || "",
    responseType:parsed.searchParams.get("responseType") || ""
  }

  const postData = authPost(reqData)
  jsonLogger.info("Auth request - Authorize", {request:postData})
  res.redirect(postData.toString())
})

export default router
