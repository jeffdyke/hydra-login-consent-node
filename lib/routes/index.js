// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import express from "express";
import crypto from "crypto";
const router = express.Router();
const CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639";
const REDIRECT_URI = "https://auth.staging.bondlink.org/callback";
const HYDRA_URL = "https://auth.staging.bondlink.org";
// Helper function to generate base64url encoded string
function base64URLEncode(buffer) {
    return buffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}
// Generate PKCE code verifier
function generateCodeVerifier() {
    return base64URLEncode(crypto.randomBytes(32));
}
// Generate PKCE code challenge from verifier
function generateCodeChallenge(verifier) {
    return base64URLEncode(crypto.createHash("sha256").update(verifier).digest());
}
router.get("/", (req, res) => {
    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString("hex");
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    // Store in session for later verification
    if (req.session) {
        req.session.state = state;
        req.session.codeVerifier = codeVerifier;
    }
    // Build authorization URL
    const authUrl = new URL(`${HYDRA_URL}/oauth2/auth`);
    authUrl.searchParams.append("client_id", CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "openid email offline");
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("code_challenge", codeChallenge);
    authUrl.searchParams.append("code_challenge_method", "S256");
    // Redirect to Hydra for authorization
    res.redirect(authUrl.toString());
});
export default router;
