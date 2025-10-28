import express from "express"
import url from "url"
import urljoin from "url-join"
import { generateCsrfToken, XSRF_TOKEN_NAME } from "../config.js"
import { hydraAdmin, HYDRA_CONFIG } from "../setup/hydra.js"
import { oidcConformityMaybeFakeSession } from "./stub/oidc-cert.js"
import { AcceptOAuth2ConsentRequestSession } from "@ory/client-fetch"
import jsonLogger  from "../logging.js"

const router = express.Router()
router.get("/", async (req, res) => {
  const { consent_challenge } = req.query;
  const consentInfo = await fetch(
    `${HYDRA_CONFIG.basePath}/admin/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`
  ).then(r => r.json());

  const acceptResponse = await fetch(
    `${HYDRA_CONFIG.basePath}/admin/oauth2/auth/requests/consent/accept`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_scope: consentInfo.requested_scope,
        grant_access_token_audience: consentInfo.requested_access_token_audience,
        session: {
          id_token: {}, // Will be populated after Google auth
          access_token: {}
        },
        remember: true,
        remember_for: 3600
      })
    }
  ).then(r => {
    jsonLogger.info("acceptResponse:then", {meta:r})
    r.json()
  });
  jsonLogger.info("acceptResponse with consentInfo", {resp:acceptResponse,consent:consentInfo})

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID || "");
  googleAuthUrl.searchParams.set('redirect_uri', "https://auth.staging.bondlink.org/callback");
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', consentInfo.requested_scope.join(' '));
  googleAuthUrl.searchParams.set('state', consentInfo.state); // Pass through for tracking
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');
  jsonLogger.info("googleAuthUrl", {u:googleAuthUrl})

  res.redirect(googleAuthUrl.toString());
})

export default router
