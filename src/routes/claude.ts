import express from "express"
import redis from "../setup/redis.js"
import { GoogleTokenResponse, RedisRefreshToken, validatePKCE } from "../setup/index.js"
import { TokenPayload } from 'google-auth-library';
import { pkceStateByKey } from "../setup/pkce-redis.js"
import jsonLogger from "../logging.js"
import { googleRefreshResponse } from "../google_auth.js"
const router = express.Router()

interface SessionOAuthTokens {
  hydra_refresh_token: string
  google?: GoogleTokenResponse | {}
}

// This can fail in at least 5 ways, handle them
router.post("/token", async (req,res) => {
  const params = req.body

  if (params.grant_type == 'authorization_code') {
    jsonLogger.info("data passed into authorization_code", req.body)
    const authCode = params.code
    const authDataStr = await redis.get(`auth_code:${req.session.id}`)

    jsonLogger.info("Json result ", {res:authDataStr, request:`auth_code:${req.session.id}`})
    const authData = JSON.parse(authDataStr || "")
    const pkceState = await pkceStateByKey(`auth_code_state:${req.session.id}`)
    /**
     * clean up one time, this is the end, fail or not
     */
    await redis.del(`auth_code:${req.session.id}`);
    await redis.del(`auth_code_state:${req.session.id}`)
    delete req.session.pkceKey
    const isValidPKCE = validatePKCE(
      params.code_verifier,
      pkceState.code_challenge,
      pkceState.code_challenge_method
    )
    if (!isValidPKCE) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'PKCE validation failed'
      })
    }
    // jsonLogger.info("authData", authData)
    /**
     * new refresh token for claude based on google's response
     */
    const tokenObj = authData.google_tokens.tokens
    jsonLogger.silly("tokenObject", tokenObj)
    const refreshTokenO:RedisRefreshToken = {
      client_id: pkceState.client_id,
      google_refresh_token: authData.google_tokens.tokens.refresh_token,
      scope: authData.google_tokens.tokens.scope,
      subject: authData.subject || "user",
      created_at: Date.now()
    }

    const refreshToken = authData.google_tokens.tokens.refresh_token
    jsonLogger.silly("RefreshToken ", {id:req.session.id, hash:refreshToken, ...authData.google_tokens.tokens})
    await redis.set(`refresh_token:${req.session.id}`,
      JSON.stringify(refreshTokenO),
      'EX',
      60 * 60 * 24 * 30
    ).then((resp) => {
      jsonLogger.info("Response for new refresh_token", resp)
    }).catch((err) => {
      jsonLogger.error("Failed to write refresh token data", {error:err, key:`refresh_token:${req.session.id}`})
    }); // 30 days


    res.json({
      access_token: authData.google_tokens.access_token,
      token_type: 'Bearer',
      expires_in: authData.google_tokens.tokens.expires_in,
      refresh_token: authData.google_tokens.tokens.refresh_token,
      scope: authData.google_tokens.tokens.scope
    });
  } else if (params.grant_type == "refresh_token") {
    /**
     * we can get bad data in here, need to make sure its all new
     */
    const { refresh_token, client_id, scope } = req.body;
    jsonLogger.info("Data passed into refresh_token", req.body)
    if (!refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token required'
      });
    }

    if (!client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id required'
      });
    }
    const fetchName = `refresh_token:${refresh_token}`

    const tokenDataStr = await redis.get(fetchName).then(resp => {
      if (!resp) {
        new Error(`Response is empty for ${fetchName}`)
      }
      jsonLogger.info("found tokenDataStr ", {key:fetchName, resp:resp})
      return resp
    }).catch((err) => {
      jsonLogger.error("error fetching refresh_token", {query:fetchName})
      return err.message.data
    })

    jsonLogger.info("tokenDataStr is ", {r: tokenDataStr})
    if (!tokenDataStr) {
      jsonLogger.error("Token data string")
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired refresh token'
      });
    }

    const tokenData = JSON.parse(tokenDataStr);
    jsonLogger.info("token data dump, skipping validation to check logs", {data:tokenData,s:tokenDataStr})
    // Validate client_id
    // if (tokenData.client_id !== client_id) {
    //   jsonLogger.error("invalid client id", {td:tokenData.client_id,lcl:client_id })
    //   return res.status(400).json({
    //     error: 'invalid_grant',
    //     error_description: 'Client mismatch'
    //   });
    // }

    // Optional: Validate scope (if requesting narrower scope)
    if (scope) {
      const requestedScopes = scope.split(' ');
      const grantedScopes = tokenData.scope.split(' ');

      const hasAllScopes = requestedScopes.every((s:string) => grantedScopes.includes(s));
      if (!hasAllScopes) {
        jsonLogger.error("invalid scope", {req:requestedScopes,granted:grantedScopes })
        return res.status(400).json({
          error: 'invalid_scope',
          error_description: 'Requested scope exceeds granted scope'
        });
      }
    }

    const payload:GoogleTokenResponse = await googleRefreshResponse(tokenData).then((gResponse) => {
      return gResponse
    }).catch((err) => {
      jsonLogger.error("Failed to fetch a refresh token", {token:tokenData, error:err})
    })
    jsonLogger.info("play load", {payload:payload})
    const newGoogleTokens = payload.access_token || tokenData.google_refresh_token
    if (newGoogleTokens.error) {
      // Google refresh token is invalid or expired
      await redis.del(`refresh_token:${refresh_token}`);

      return res.status(400).json({
        error: 'invalid_grant',
        error_description: newGoogleTokens.error_description || 'Refresh token expired or revoked'
      });
    }
    const updatedGoogleRefreshToken = newGoogleTokens.refresh_token || tokenData.google_refresh_token;
    jsonLogger.info("refresh_choice", updatedGoogleRefreshToken)
    await redis.set(`refresh_token:${refresh_token}`, JSON.stringify({
        ...tokenData,
        google_refresh_token: updatedGoogleRefreshToken,
        updated_at: Date.now()
      }),
      'EX',
      60 * 60 * 24 * 30
    );
    return res.json({
      access_token: payload.access_token,
      token_type: 'Bearer',
      expires_in: newGoogleTokens.expires_in || 3600,
      refresh_token: refresh_token, // Same refresh token for Claude
      scope: newGoogleTokens.scope || tokenData.scope
    });
  }

})

export default router
