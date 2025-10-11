"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const url_1 = __importDefault(require("url"));
const url_join_1 = __importDefault(require("url-join"));
const csurf_1 = __importDefault(require("csurf"));
const config_1 = require("../config");
// Sets up csrf protection
const csrfProtection = (0, csurf_1.default)({ cookie: true });
const router = express_1.default.Router();
router.get("/", csrfProtection, (req, res, next) => {
    // Parses the URL query
    const query = url_1.default.parse(req.url, true).query;
    // The challenge is used to fetch information about the logout request from ORY Hydra.
    const challenge = String(query.logout_challenge);
    if (!challenge) {
        next(new Error("Expected a logout challenge to be set but received none."));
        return;
    }
    config_1.hydraAdmin
        .getOAuth2LogoutRequest({ logoutChallenge: challenge })
        // This will be called if the HTTP request was successful
        .then(() => {
        // Here we have access to e.g. response.subject, response.sid, ...
        // The most secure way to perform a logout request is by asking the user if he/she really want to log out.
        res.render("logout", {
            csrfToken: req.csrfToken(),
            challenge: challenge,
            action: (0, url_join_1.default)(process.env.BASE_URL || "", "/logout"),
        });
    })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next);
});
router.post("/", csrfProtection, (req, res, next) => {
    // The challenge is now a hidden input field, so let's take it from the request body instead
    const challenge = req.body.challenge;
    if (req.body.submit === "No") {
        return (config_1.hydraAdmin
            .rejectOAuth2LogoutRequest({ logoutChallenge: challenge })
            .then(() => {
            // The user did not want to log out. Let's redirect him back somewhere or do something else.
            res.redirect("https://www.ory.sh/");
        })
            // This will handle any error that happens when making HTTP calls to hydra
            .catch(next));
    }
    // The user agreed to log out, let's accept the logout request.
    config_1.hydraAdmin
        .acceptOAuth2LogoutRequest({ logoutChallenge: challenge })
        .then(({ redirect_to }) => {
        // All we need to do now is to redirect the user back to hydra!
        res.redirect(String(redirect_to));
    })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next);
});
exports.default = router;
