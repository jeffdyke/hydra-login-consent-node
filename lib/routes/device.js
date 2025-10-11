"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const url_1 = __importDefault(require("url"));
const csurf_1 = __importDefault(require("csurf"));
const config_1 = require("../config");
// Sets up csrf protection
const csrfProtection = (0, csurf_1.default)({ cookie: true });
const router = express_1.default.Router();
router.get("/verify", csrfProtection, (req, res, next) => {
    // Parses the URL query
    const query = url_1.default.parse(req.url, true).query;
    // The challenge is used to fetch information about the login request from ORY Hydra.
    const challenge = String(query.device_challenge);
    if (!challenge) {
        next(new Error("Expected a device challenge to be set but received none."));
        return;
    }
    res.render("device/verify", {
        csrfToken: req.csrfToken(),
        challenge,
        userCode: String(query.user_code),
    });
});
router.post("/verify", csrfProtection, (req, res, next) => {
    // The code is a input field, so let's take it from the request body
    const { code: userCode, challenge } = req.body;
    // All we need to do now is to redirect the user back to hydra!
    config_1.hydraAdmin
        .acceptUserCodeRequest({
        deviceChallenge: challenge,
        acceptDeviceUserCodeRequest: {
            user_code: userCode,
        },
    })
        .then(({ redirect_to }) => {
        // All we need to do now is to redirect the user back to hydra!
        res.redirect(String(redirect_to));
    })
        .catch(next);
});
router.get("/success", csrfProtection, (req, res, next) => {
    res.render("device/success", {
        csrfToken: req.csrfToken(),
    });
});
exports.default = router;
