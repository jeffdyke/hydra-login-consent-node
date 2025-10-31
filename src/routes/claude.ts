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
    jsonLogger.debug("data passed into authorization_code", req.body)
    const authCode = params.code
    //Clean this up
    const authDataStr = await redis.get(`auth_code:${authCode}`)
    const authData = JSON.parse(authDataStr || "")
    const pkceState = await pkceStateByKey(`auth_code_state:${authCode}`)
    /**
     * clean up one time, this is the end, fail or not
     */
    await redis.del(`auth_code:${authCode}`);
    await redis.del(`auth_code_state:${authCode}`)
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
    /**
     * new refresh token for claude based on google's response
     */
    // Consider a new key other than req.session.id or authCode
    const tokenObj = authData.google_tokens.tokens
    // jsonLogger.silly("tokenObject", tokenObj)
    const refreshTokenO:RedisRefreshToken = {
      client_id: pkceState.client_id,
      google_refresh_token: tokenObj.refresh_token,
      access_token: tokenObj.access_token,
      scope: tokenObj.scope,
      subject: authData.subject || "user",
      created_at: Date.now(),
      expires_in: 3600
    }

    await redis.set(`refresh_token:${refreshTokenO.google_refresh_token}`,
      JSON.stringify(refreshTokenO),
      'EX',
      60 * 60 * 24 * 30
    ).catch((err) => {
      jsonLogger.error("Failed to write refresh token data", {error:err, key:`refresh_token:${refreshTokenO.google_refresh_token}`})
    });

    const resp = {
      access_token: refreshTokenO.access_token,
      token_type: 'Bearer',
      expires_in: refreshTokenO.expires_in,
      refresh_token: refreshTokenO.google_refresh_token,
      scope: refreshTokenO.scope
    }
    jsonLogger.info("Returning json payload", resp)
    res.json(resp);
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
    await redis.set(`refresh_token:${updatedGoogleRefreshToken}`, JSON.stringify({
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
      refresh_token: updatedGoogleRefreshToken, // Same refresh token for Claude
      scope: newGoogleTokens.scope || tokenData.scope
    });
  } else {
    jsonLogger.error("THIS SHOULD NEVER HIT")
    res.status(400).render("In else of /token, should never get here")
  }

})

export default router
