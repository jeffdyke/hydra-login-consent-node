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
    const pkceData = await fetchPkce(req, "Callback get")

    jsonLogger.info("CALLBACK GET", {
      code:code,
      returnedState:returnedState,
      createClientId:createClientId,
      redisState:pkceData.state,
      redisCodeChallenge:pkceData.code_challenge,
      pkceKey:req.session.pkceKey

  })
    /**
     * call to google, get tokens for this session
     * create a new authCode, which will be for claude to validate
     * along with its original state sent into /oauth2/auth
     * store it in redis, to handle Claude's next call to confirm the token,
     * which has to go through hydra
     */
    const googleTokens = await googleOAuthTokens(code as string, appConfig.middlewareRedirectUri)
    .then(resp => {
      return resp
    }).catch(err => {
      res.status(400).send(`Google token request failed with ${err}`)
    })
    const authCode = crypto.randomBytes(32).toString('base64url')
    await redis.set(`auth_code_state:${authCode}`, JSON.stringify(pkceData))
    .catch((err) => {
      jsonLogger.error("Failed to write new data to redis", {error:err, key:`auth_code_state:${authCode}`})
    })

    await redis.set(`auth_code:${authCode}`, JSON.stringify({
      google_tokens: googleTokens,
      session_id: req.session.pkceKey,
      created_at: Date.now()
    }), 'EX', 300).catch(rSet => {
      jsonLogger.error("error creating auth_code.", {setError:rSet, key:`auth_code:${authCode}`})
    });
    //pkce is short lived, delete it
    await redis.del(pkceRedisKey(req))

    jsonLogger.info("Calling claude with a new authCode and the original state", {hashString:authCode})
    const claudeCallback = new URL(pkceData.redirect_uri);
    claudeCallback.searchParams.set('code', authCode);
    claudeCallback.searchParams.set('state', pkceData.state);

    res.redirect(claudeCallback.toString());
  } else {
    jsonLogger.info("Missing code session ", {code:code, session:JSON.stringify(req.session)})
    res.status(400).send("Missing code or session ")
  }
})

export default router
