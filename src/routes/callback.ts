import express from "express"
import { googleOAuthTokens } from "../google_auth.js"
import jsonLogger  from "../logging.js"
import {appConfig} from "../config.js"
import { fetchPkce, pkceRedisKey } from "../setup/pkce-redis.js"
import {CLIENT_ID} from "../setup/hydra.js"
import * as crypto from 'crypto';
const router = express.Router()
import redis from "../setup/redis.js"

router.get("/", async (req, res) => {
  const code = req.query.code
  const returnedState = req.query.state
  const createClientId = CLIENT_ID


  if (code && req.session) {
    const pkceData = await fetchPkce(req)
    jsonLogger.info("CALLBACK GET - don't need session data, using redis", {
      code:code,
      returnedState:returnedState,
      createClientId:createClientId,
      sessionState:req.session.state,
      redisState:pkceData.state,
      sessionCodeChallenge:req.session.codeChallenge,
      redisCodeChallenge:pkceData.code_challenge,
      pkceKey:req.session.pkceKey

  })
    const storedState = pkceData.state
    const codeChallenge = pkceData.code_challenge
    jsonLogger.info(
      "State vs ReturnedState",{
        storedState: storedState,
        returnedState: returnedState,
        codeChallenge: codeChallenge,
      }
    )

    /**
     * call to google, get tokens for this session
     * create a new authCode, which will be for claude to validate
     * along with its original state sent into /oauth2/auth
     * store it in redis, to handle Claude's next call to confirm the token,
     * which has to go through hydra
     */
    const googleTokens = await googleOAuthTokens(code as string, appConfig.middlewareRedirectUri).then(resp => {
      jsonLogger.info("GoogleTokens", {resp:resp})
      return resp
    }).catch(err => {
      res.status(400).send(`Google token request failed with ${err}`)
    })
    const authCode = crypto.randomBytes(32).toString('base64url')
    jsonLogger.info("Save a new hash by authCode, as Claude will be sending that back to the /oauth2/token endpoint")
    await redis.set(`auth_code_state:${authCode}`, JSON.stringify(pkceData)).then((response) => {
      jsonLogger.info("set new json data for validation", {data:response})
    }).catch((err) => {
      jsonLogger.error("Failed to write new data to redis")
    })

    await redis.set(`auth_code:${authCode}`, JSON.stringify({
      google_tokens: googleTokens,
      session_id: req.session.pkceKey,
      created_at: Date.now()
    }), 'EX', 300);
    await redis.del(pkceRedisKey(req)).then(r => jsonLogger.info("Deleted redis state data on pkceKey", {key:pkceRedisKey(req)}))

    jsonLogger.info("Calling claude with a new authCode and the original state", {auth:authCode,claudeState:pkceData.state})
    const claudeCallback = new URL(pkceData.redirect_uri);
    claudeCallback.searchParams.set('code', authCode);
    claudeCallback.searchParams.set('state', pkceData.state);

    res.redirect(claudeCallback.toString());

    // Below is no longer needed, commenting out to ensure its not firing

    // --------------------------------------------------------
    // TODO why doesn't this return a state
    // if (returnedState !== storedState) {
    //   res.status(400).send("State mismatch - possible CSRF attack")
    //   return
    // }
    // Not sure this should be auto generated
    // let body = new URLSearchParams({
    //       grant_type: "authorization_code",
    //       code: code as string,
    //       redirect_uri: appConfig.claudeRedirectUri,
    //       client_id: createClientId,
    //       code_verifier: codeChallenge ?? "",
    //       state: pkceData.state ?? "",
    //     })
    // // Exchange code for tokens WITH code_verifier
    // axios.post(`${process.env.HYDRA_URL}/oauth2/token`, body.toString(), {
    //     headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // }).then(data => {
    //     jsonLogger.info("Post Success", {response: data, state: pkceData.state, verifier: pkceData.code_challenge})
    //     // Clear stored values from session
    //     // TODO, should all off the redis key be deleted, perhaps exchange for an authenticated
    //     if (req.session) {
    //       delete req.session.codeChallenge
    //       delete req.session.state
    //     }
    //     const resp = googleTokenResponse(code as string)

    //     let jsonOut = JSON.stringify(resp, null, 2)
    //     res.render(
    //       'callback', {
    //         pageTitle: 'Callback Results',
    //         pageData: jsonOut
    //       }

    //     )
    //     // Send response to client
    //     // res.send(JSON.stringify(data, null, 2))
    //   })
    //   .catch((err) => {
    //     res.status(500).send(`Error Caught in callback: ${err.message} with body ${body}`)
    //   })
  } else {
    jsonLogger.info("Missing code session ", {code:code, session:JSON.stringify(req.session)})
    res.status(400).send("Missing code or session ")
  }
})

export default router
