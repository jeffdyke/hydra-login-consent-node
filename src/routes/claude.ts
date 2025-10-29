import express from "express"
import url from "url"
import urljoin from "url-join"

import { Redis } from "ioredis"
import { CLIENT_ID, HYDRA_CONFIG } from "../setup/hydra.js"
import {generateCsrfToken, HYDRA_URL, CLAUDE_CLIENT_ID, appConfig} from "../config.js"
import { CLAUDE_REDIRECT_URL } from "../authFlow.js"
import jsonLogger from "../logging.js"
const router = express.Router()
const redis = new Redis({
  host: appConfig.redisHost,
  port: appConfig.redisPort,
}

)
router.get('/auth', async (req, res) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,        // From Claude - YOU will validate this
    code_challenge_method,
    scope
  } = req.query;

  // Validate PKCE parameters
  if (!code_challenge || code_challenge_method !== 'S256') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'PKCE required'
    });
  }

  const sessionId = crypto.randomUUID();

  await redis.set(`pkce_session:${sessionId}`, JSON.stringify({
    code_challenge,
    code_challenge_method,
    client_id,
    redirect_uri,
    scope,
    state,
    timestamp: Date.now()
  }));
  jsonLogger.info("Session stored")
  // Now start Hydra flow WITHOUT PKCE (Hydra doesn't need to know about it)
  const hydraAuthUrl = new URL(`${appConfig.hydraInternalUrl}/oauth2/auth`);
  hydraAuthUrl.searchParams.set('client_id', CLIENT_ID);
  hydraAuthUrl.searchParams.set('response_type', 'code');
  hydraAuthUrl.searchParams.set('redirect_uri', CLAUDE_REDIRECT_URL);
  hydraAuthUrl.searchParams.set('scope', "openid profile email offline");
  hydraAuthUrl.searchParams.set('state', sessionId); // Use your session ID
  jsonLogger.info("sending to hydra", {request:hydraAuthUrl})
  res.redirect(hydraAuthUrl.toString());
});

export default router
// Step 2: Handle Hydra login
// app.get('/login', async (req, res) => {
//   const { login_challenge } = req.query;

//   const loginInfo = await fetch(
//     `http://hydra:4445/admin/oauth2/auth/requests/login?login_challenge=${login_challenge}`
//   ).then(r => r.json());

//   // Auto-accept login (or show your login UI)
//   const acceptResponse = await fetch(
//     'http://hydra:4445/admin/oauth2/auth/requests/login/accept',
//     {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         subject: `user_${Date.now()}`,
//         remember: true,
//         remember_for: 3600
//       })
//     }
//   ).then(r => r.json());

//   res.redirect(acceptResponse.redirect_to);
// });

// // Step 3: Handle consent and redirect to Google
// app.get('/consent', async (req, res) => {
//   const { consent_challenge } = req.query;

//   const consentInfo = await fetch(
//     `http://hydra:4445/admin/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`
//   ).then(r => r.json());

//   // Get session ID from Hydra's state/context
//   const sessionId = consentInfo.login_session_id || consentInfo.context?.state;

//   // Auto-accept Hydra consent
//   const acceptResponse = await fetch(
//     'http://hydra:4445/admin/oauth2/auth/requests/consent/accept',
//     {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         grant_scope: consentInfo.requested_scope,
//         remember: true,
//         remember_for: 3600,
//         session: {
//           access_token: {
//             session_id: sessionId // Store session ID in token
//           }
//         }
//       })
//     }
//   ).then(r => r.json());

//   // Store Hydra redirect for after Google
//   await redis.set(
//     `hydra_redirect:${sessionId}`,
//     acceptResponse.redirect_to,
//     'EX',
//     600
//   );

//   // Redirect to Google
//   const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
//   googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
//   googleAuthUrl.searchParams.set('redirect_uri', process.env.MIDDLEWARE_CALLBACK);
//   googleAuthUrl.searchParams.set('response_type', 'code');
//   googleAuthUrl.searchParams.set('scope', consentInfo.requested_scope.join(' '));
//   googleAuthUrl.searchParams.set('state', sessionId); // Pass session ID
//   googleAuthUrl.searchParams.set('access_type', 'offline');
//   googleAuthUrl.searchParams.set('prompt', 'consent');

//   res.redirect(googleAuthUrl.toString());
// });

// // Step 4: Google callback - exchange for tokens
// app.get('/oauth/google/callback', async (req, res) => {
//   const { code, state: sessionId, error } = req.query;

//   if (error) {
//     return res.status(400).json({ error });
//   }

//   // Exchange Google code for tokens
//   const googleTokens = await fetch('https://oauth2.googleapis.com/token', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//     body: new URLSearchParams({
//       code,
//       client_id: process.env.GOOGLE_CLIENT_ID,
//       client_secret: process.env.GOOGLE_CLIENT_SECRET,
//       redirect_uri: process.env.MIDDLEWARE_CALLBACK,
//       grant_type: 'authorization_code'
//     })
//   }).then(r => r.json());

//   if (googleTokens.error) {
//     return res.status(400).json(googleTokens);
//   }

//   // Generate YOUR authorization code for Claude
//   const authCode = crypto.randomBytes(32).toString('base64url');

//   // Store the code with Google tokens AND session ID
//   await redis.set(`auth_code:${authCode}`, JSON.stringify({
//     google_tokens: googleTokens,
//     session_id: sessionId,
//     created_at: Date.now()
//   }), 'EX', 300); // 5 minutes

//   // Get original PKCE session and Claude's state
//   const pkceSession = JSON.parse(
//     await redis.get(`pkce_session:${sessionId}`)
//   );

//   // Redirect back to Claude with YOUR auth code
//   const claudeCallback = new URL(pkceSession.redirect_uri);
//   claudeCallback.searchParams.set('code', authCode);
//   claudeCallback.searchParams.set('state', pkceSession.state);

//   res.redirect(claudeCallback.toString());
// });

// // Step 5: Token endpoint - YOU validate PKCE here
// app.post('/oauth/token', async (req, res) => {
//   const {
//     grant_type,
//     code,
//     code_verifier,  // From Claude - validate against stored challenge
//     client_id,
//     redirect_uri
//   } = req.body;

//   if (grant_type !== 'authorization_code') {
//     return res.status(400).json({
//       error: 'unsupported_grant_type'
//     });
//   }

//   // Get stored auth code data
//   const authDataStr = await redis.get(`auth_code:${code}`);
//   if (!authDataStr) {
//     return res.status(400).json({
//       error: 'invalid_grant',
//       error_description: 'Invalid or expired authorization code'
//     });
//   }

//   const authData = JSON.parse(authDataStr);

//   // Delete code (one-time use)
//   await redis.del(`auth_code:${code}`);

//   // Get PKCE session
//   const pkceSessionStr = await redis.get(`pkce_session:${authData.session_id}`);
//   if (!pkceSessionStr) {
//     return res.status(400).json({
//       error: 'invalid_grant',
//       error_description: 'Session expired'
//     });
//   }

//   const pkceSession = JSON.parse(pkceSessionStr);

//   // *** THIS IS WHERE YOU VALIDATE PKCE ***
//   if (!code_verifier) {
//     return res.status(400).json({
//       error: 'invalid_request',
//       error_description: 'code_verifier required'
//     });
//   }

//   // Validate PKCE
//   const isValidPKCE = validatePKCE(
//     code_verifier,
//     pkceSession.code_challenge,
//     pkceSession.code_challenge_method
//   );

//   if (!isValidPKCE) {
//     return res.status(400).json({
//       error: 'invalid_grant',
//       error_description: 'PKCE validation failed'
//     });
//   }

//   // PKCE valid! Return Google tokens to Claude
//   res.json({
//     access_token: authData.google_tokens.access_token,
//     token_type: 'Bearer',
//     expires_in: authData.google_tokens.expires_in,
//     refresh_token: authData.google_tokens.refresh_token,
//     scope: authData.google_tokens.scope
//   });
// });

// // PKCE validation function
// function validatePKCE(code_verifier, code_challenge, code_challenge_method) {
//   if (code_challenge_method !== 'S256') {
//     return false;
//   }

//   const hash = crypto
//     .createHash('sha256')
//     .update(code_verifier)
//     .digest();

//   const computed_challenge = hash
//     .toString('base64')
//     .replace(/\+/g, '-')
//     .replace(/\//g, '_')
//     .replace(/=/g, '');

//   return computed_challenge === code_challenge;
// }
