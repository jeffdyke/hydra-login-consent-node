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
    jsonLogger.info("CALLBACK GET", {
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
    const authCodeO = {
      redisKey: `${req.session.id}`,
      authHash: authCode,
      authState: JSON.stringify(pkceData)

    }
    jsonLogger.info("Save a new hash by authCode, as Claude will be sending that back to the /oauth2/token endpoint",
      authCodeO
    )

    await redis.set(`auth_code_state:${authCodeO.redisKey}`, JSON.stringify(pkceData)).then((response) => {
      jsonLogger.info("set new json data for validation", {data:response, key:authCodeO.redisKey})
    }).catch((err) => {
      jsonLogger.error("Failed to write new data to redis", {error:err, key:`auth_code_state:${authCodeO.redisKey}`})
    })

    await redis.set(`auth_code:${authCodeO.redisKey}`, JSON.stringify({
      google_tokens: googleTokens,
      session_id: req.session.pkceKey,
      created_at: Date.now()
    }), 'EX', 300).catch(rSet => {
      jsonLogger.error("error creating auth_code.", {setError:rSet, key:`auth_code:${authCodeO.redisKey}`})
    });
    //pkce is short lived, delete it
    await redis.del(pkceRedisKey(req)).then(r => jsonLogger.info("Deleted redis state data on pkceKey", {key:pkceRedisKey(req)}))

    jsonLogger.info("Calling claude with a new authCode and the original state", {auth:authCodeO, hashString:authCode})
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
