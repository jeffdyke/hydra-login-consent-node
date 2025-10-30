import express from "express"
import { HYDRA_CONFIG } from "../setup/hydra.js"
import jsonLogger  from "../logging.js"
import { fetchPkce } from "../setup/pkce-redis.js"
const router = express.Router()

router.get("/", async (req, res) => {
  const { consent_challenge } = req.query;
  const consentInfo = await fetch(
    `${HYDRA_CONFIG.basePath}/admin/oauth2/auth/requests/consent?challenge=${consent_challenge}`
  ).then(r => {
    // jsonLogger.info("response for challenge", {resp:r})
    return r.json()
  }).catch(err => {
    jsonLogger.error("caught error requesting consentInfo", {e:err})
    res.status(400).render(`Failed to get consent info ${err}`)
  });

  //jsonLogger.info("Consent info ", {referrer:forState.searchParams.get("state")})
  const acceptResponse = await fetch(
    `${HYDRA_CONFIG.basePath}/admin/oauth2/auth/requests/consent/accept?challenge=${consent_challenge}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_scope: req.query.requested_scope,
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
    // jsonLogger.info("acceptResponse returned ", {resp:r})
    return r
  }).catch(err => {
    jsonLogger.error("caught error in PUT to consent accept", {e:err})
    res.status(400).render(`Failed to get consent info ${err}`)
  });
  // jsonLogger.info("Client data", {
  //   grant:consentInfo.client.grant_types,
  //   responseTypes:consentInfo.client.response_types,redirectUris:
  //   consentInfo.client.redirect_uris
  // })
  // jsonLogger.info("acceptResponse with consentInfo", {resp:acceptResponse,consent:consentInfo})
  const clientOauth = await fetchPkce(req)

  jsonLogger.info("Client Oauth Creds", {creds: clientOauth})
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID || "");
  googleAuthUrl.searchParams.set('redirect_uri', "https://auth.staging.bondlink.org/callback");
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid profile email');
  googleAuthUrl.searchParams.set('state', clientOauth.state || ""); // Pass through for tracking
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');


  res.redirect(googleAuthUrl.toString());
})

export default router
