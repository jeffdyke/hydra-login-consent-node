"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var crypto_1 = __importDefault(require("crypto"));
var router = express_1.default.Router();
var CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639";
var REDIRECT_URI = "https://auth.staging.bondlink.org/callback";
var HYDRA_URL = "https://auth.staging.bondlink.org";
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
    return base64URLEncode(crypto_1.default.randomBytes(32));
}
// Generate PKCE code challenge from verifier
function generateCodeChallenge(verifier) {
    return base64URLEncode(crypto_1.default.createHash("sha256").update(verifier).digest());
}
router.get("/", function (req, res) {
    // Generate state for CSRF protection
    var state = crypto_1.default.randomBytes(16).toString("hex");
    // Generate PKCE parameters
    var codeVerifier = generateCodeVerifier();
    var codeChallenge = generateCodeChallenge(codeVerifier);
    // Store in session for later verification
    if (req.session) {
        req.session.state = state;
        req.session.codeVerifier = codeVerifier;
    }
    // Build authorization URL
    var authUrl = new URL("".concat(HYDRA_URL, "/oauth2/auth"));
    authUrl.searchParams.append("client_id", CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "openid email");
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("code_challenge", codeChallenge);
    authUrl.searchParams.append("code_challenge_method", "S256");
    // Redirect to Hydra for authorization
    res.redirect(authUrl.toString());
});
exports.default = router;
