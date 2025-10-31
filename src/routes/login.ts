import express from "express"
import url from "url"
import { hydraAdmin } from "../setup/hydra.js"
import { oidcConformityMaybeFakeAcr } from "./stub/oidc-cert.js"
import jsonLogger from "../logging.js"

const router = express.Router()

router.get("/", (req, res, next) => {
  const query = url.parse(req.url, true).query
  const challenge = String(query.login_challenge)
  if (!challenge) {
    next(new Error("Expected a login challenge to be set but received none."))
    return
  }

  hydraAdmin
    .getOAuth2LoginRequest({
      loginChallenge: challenge,
    })
    .then(loginRequest => {
      jsonLogger.debug("passed login challenge, now requesting login", {lr: loginRequest.client.client_id})
      return hydraAdmin
          .acceptOAuth2LoginRequest({
            loginChallenge: challenge,
            acceptOAuth2LoginRequest: {
              subject: String("claude@claude.ai"),
            },
          })
          .then(({ redirect_to }) => {
            res.redirect(String(redirect_to))
          })
      }).catch(err => {
        jsonLogger.error("caught an error after loginRequest", {error:err})
        next
      })
    })


/**
 * This is an auto accept for now, forms have been removed
 * This conforms to the overall OAuth flow
 */
router.post("/", (req, res, next) => {
  const challenge = req.body.challenge
  hydraAdmin
    .getOAuth2LoginRequest({ loginChallenge: challenge })
    .then((loginRequest) =>
      hydraAdmin
        .acceptOAuth2LoginRequest({
          loginChallenge: challenge,
          //This deserves better defaults.
          acceptOAuth2LoginRequest: {
            // Subject is an alias for user ID. A subject can be a random string, a UUID, an email address, ....
            subject: "claude@claude.ai",

            // This tells hydra to remember the browser and automatically authenticate the user in future requests. This will
            // set the "skip" parameter in the other route to true on subsequent requests!
            remember: Boolean(true),

            // When the session expires, in seconds. Set this to 0 so it will never expire.
            remember_for: 3600,
            // Sets which "level" (e.g. 2-factor authentication) of authentication the user has. The value is really arbitrary
            // and optional. In the context of OpenID Connect, a value of 0 indicates the lowest authorization level.
            // acr: '0',
            //
            // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
            // the app is built for the automated OpenID Connect Conformity Test Suite. You
            // can peak inside the code for some ideas, but be aware that all data is fake
            // and this only exists to fake a login system which works in accordance to OpenID Connect.
            //
            // If that variable is not set, the ACR value will be set to the default passed here ('0')
            acr: oidcConformityMaybeFakeAcr(loginRequest, "0"),
          },
        })
        .then(({ redirect_to }) => {
          jsonLogger.debug("redirecting to ", {redirect_to:redirect_to})
          // All we need to do now is to redirect the user back to hydra!
          res.redirect(String(redirect_to))
        }).catch(err => {
          jsonLogger.error("caught error accepting login request", {error:err})
        })
    )
    // This will handle any error that happens when making HTTP calls to hydra
    .catch((e) => {
      jsonLogger.error("cauth error sending call to hydra", {error:e})
      next()
    })
})

export default router
