"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var url_1 = __importDefault(require("url"));
var csurf_1 = __importDefault(require("csurf"));
var config_1 = require("../config");
// Sets up csrf protection
var csrfProtection = (0, csurf_1.default)({ cookie: true });
var router = express_1.default.Router();
router.get("/verify", csrfProtection, function (req, res, next) {
    // Parses the URL query
    var query = url_1.default.parse(req.url, true).query;
    // The challenge is used to fetch information about the login request from ORY Hydra.
    var challenge = String(query.device_challenge);
    if (!challenge) {
        next(new Error("Expected a device challenge to be set but received none."));
        return;
    }
    res.render("device/verify", {
        csrfToken: req.csrfToken(),
        challenge: challenge,
        userCode: String(query.user_code),
    });
});
router.post("/verify", csrfProtection, function (req, res, next) {
    // The code is a input field, so let's take it from the request body
    var _a = req.body, userCode = _a.code, challenge = _a.challenge;
    // All we need to do now is to redirect the user back to hydra!
    config_1.hydraAdmin
        .acceptUserCodeRequest({
        deviceChallenge: challenge,
        acceptDeviceUserCodeRequest: {
            user_code: userCode,
        },
    })
        .then(function (_a) {
        var redirect_to = _a.redirect_to;
        // All we need to do now is to redirect the user back to hydra!
        res.redirect(String(redirect_to));
    })
        .catch(next);
});
router.get("/success", csrfProtection, function (req, res, next) {
    res.render("device/success", {
        csrfToken: req.csrfToken(),
    });
});
exports.default = router;
