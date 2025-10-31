import express from "express"
import { HYDRA_CONFIG } from "../setup/hydra.js"
import jsonLogger  from "../logging.js"
import { fetchPkce } from "../setup/pkce-redis.js"
const router = express.Router()
import { appConfig } from "../config.js"

router.get("/", async (req, res) => {
  const { consent_challenge } = req.query;
  //This returning an implicit json object is dumb, should be a type
  const consentInfo = await fetch(
    `${HYDRA_CONFIG.basePath}/admin/oauth2/auth/requests/consent?challenge=${consent_challenge}`
  ).then(r => {
    return r.json()
  }).catch(err => {
    jsonLogger.error("caught error requesting consentInfo", {e:err})
    res.status(400).render(`Failed to get consent info ${err}`)
  });

  const acceptResponse = await fetch(
    `${HYDRA_CONFIG.basePath}/admin/oauth2/auth/requests/consent/accept?challenge=${consent_challenge}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_scope: req.query.requested_scope,
        grant_access_token_audience: consentInfo.requested_access_token_audience,
        // Will be populated after Google auth
        session: {
          id_token: {},
          access_token: {}
        },
        remember: true,
        remember_for: 3600
      })
    }
  ).then(r => {
    return r
  }).catch(err => {
    jsonLogger.error("caught error in PUT to consent accept", {e:err})
    res.status(400).render(`Failed to get consent info ${err}`)
  });

  await fetchPkce(req, "pkce request in consent").then((oauth) => {
    jsonLogger.info("Client Oauth Creds", {creds: oauth})
    //This should be a structure that can be converted into a url
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', appConfig.googleClientId || "");
    googleAuthUrl.searchParams.set('redirect_uri', appConfig.middlewareRedirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid profile email');
    googleAuthUrl.searchParams.set('state', oauth.state || ""); // Pass through for tracking
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    res.redirect(googleAuthUrl.toString());
  }).catch((err) => {
    jsonLogger.error("Failed to get PKCE from Redis")
    res.status(400).render(`Failed to get consent info ${err}`)
  })

})

export default router
