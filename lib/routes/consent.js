"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var url_1 = __importDefault(require("url"));
var url_join_1 = __importDefault(require("url-join"));
var csurf_1 = __importDefault(require("csurf"));
var config_1 = require("../config");
var oidc_cert_1 = require("./stub/oidc-cert");
// Sets up csrf protection
var csrfProtection = (0, csurf_1.default)({
    cookie: {
        sameSite: "lax",
    },
});
var router = express_1.default.Router();
router.get("/", csrfProtection, function (req, res, next) {
    // Parses the URL query
    var query = url_1.default.parse(req.url, true).query;
    console.log("Stating /consent %s", res);
    // The challenge is used to fetch information about the consent request from ORY hydraAdmin.
    var challenge = String(query.consent_challenge);
    if (!challenge) {
        next(new Error("Expected a consent challenge to be set but received none."));
        return;
    }
    console.log("Challenge found %s", challenge);
    // This section processes consent requests and either shows the consent UI or
    // accepts the consent request right away if the user has given consent to this
    // app before
    config_1.hydraAdmin
        .getOAuth2ConsentRequest({
        consentChallenge: challenge,
    })
        // This will be called if the HTTP request was successful
        .then(function (consentRequest) {
        var _a;
        console.log("Parsing consent request %s", consentRequest);
        // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
        // Any cast needed because the SDK changes are still unreleased.
        // TODO: Remove in a later version.
        if (consentRequest.skip || ((_a = consentRequest.client) === null || _a === void 0 ? void 0 : _a.skip_consent)) {
            // You can apply logic here, for example grant another scope, or do whatever...
            // ...
            console.log("Skipped consent");
            // Now it's time to grant the consent request. You could also deny the request if something went terribly wrong
            return config_1.hydraAdmin
                .acceptOAuth2ConsentRequest({
                consentChallenge: challenge,
                acceptOAuth2ConsentRequest: {
                    // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
                    // are requested accidentally.
                    grant_scope: consentRequest.requested_scope,
                    // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
                    grant_access_token_audience: consentRequest.requested_access_token_audience,
                    // The session allows us to set session data for id and access tokens
                    session: {
                    // This data will be available when introspecting the token. Try to avoid sensitive information here,
                    // unless you limit who can introspect tokens.
                    // accessToken: { foo: 'bar' },
                    // This data will be available in the ID token.
                    // idToken: { baz: 'bar' },
                    },
                },
            })
                .then(function (_a) {
                var redirect_to = _a.redirect_to;
                // All we need to do now is to redirect the user back to hydra!
                console.log("Consent redirect %s", redirect_to);
                res.redirect(String(redirect_to));
            });
        }
        // If consent can't be skipped we MUST show the consent UI.
        console.log("Rendering consent");
        res.render("consent", {
            csrfToken: req.csrfToken(),
            challenge: challenge,
            // We have a bunch of data available from the response, check out the API docs to find what these values mean
            // and what additional data you have available.
            requested_scope: consentRequest.requested_scope,
            user: consentRequest.subject,
            client: consentRequest.client,
            action: (0, url_join_1.default)(process.env.BASE_URL || "", "/consent"),
        });
    })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next);
    // The consent request has now either been accepted automatically or rendered.
});
router.post("/", csrfProtection, function (req, res, next) {
    // The challenge is now a hidden input field, so let's take it from the request body instead
    var challenge = req.body.challenge;
    console.log("Stating POST /consent %s", challenge);
    // Let's see if the user decided to accept or reject the consent request..
    if (req.body.submit === "Deny access") {
        // Looks like the consent request was denied by the user
        return (config_1.hydraAdmin
            .rejectOAuth2ConsentRequest({
            consentChallenge: challenge,
            rejectOAuth2Request: {
                error: "access_denied",
                error_description: "The resource owner denied the request",
            },
        })
            .then(function (_a) {
            var redirect_to = _a.redirect_to;
            // All we need to do now is to redirect the browser back to hydra!
            res.redirect(String(redirect_to));
        })
            // This will handle any error that happens when making HTTP calls to hydra
            .catch(next));
    }
    // label:consent-deny-end
    var grantScope = req.body.grant_scope;
    console.log("Passed deny access with scope %s", grantScope);
    if (!Array.isArray(grantScope)) {
        grantScope = [grantScope];
    }
    // The session allows us to set session data for id and access tokens
    var session = {
        // This data will be available when introspecting the token. Try to avoid sensitive information here,
        // unless you limit who can introspect tokens.
        access_token: {
            foo: 'bar'
        },
        // This data will be available in the ID token.
        id_token: {
            baz: 'bar'
        },
    };
    // Here is also the place to add data to the ID or access token. For example,
    // if the scope 'profile' is added, add the family and given name to the ID Token claims:
    // if (grantScope.indexOf('profile')) {
    //   session.id_token.family_name = 'Doe'
    //   session.id_token.given_name = 'John'
    // }
    console.log("Fetch consent request again", { consentChallenge: challenge });
    // Let's fetch the consent request again to be able to set `grantAccessTokenAudience` properly.
    config_1.hydraAdmin
        .getOAuth2ConsentRequest({ consentChallenge: challenge })
        // This will be called if the HTTP request was successful
        .then(function (consentRequest) { return __awaiter(void 0, void 0, void 0, function () {
        var redirect_to;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Successful 2nd consent request");
                    return [4 /*yield*/, config_1.hydraAdmin.acceptOAuth2ConsentRequest({
                            consentChallenge: challenge,
                            acceptOAuth2ConsentRequest: {
                                // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
                                // are requested accidentally.
                                grant_scope: grantScope,
                                // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
                                // the app is built for the automated OpenID Connect Conformity Test Suite. You
                                // can peak inside the code for some ideas, but be aware that all data is fake
                                // and this only exists to fake a login system which works in accordance to OpenID Connect.
                                //
                                // If that variable is not set, the session will be used as-is.
                                session: (0, oidc_cert_1.oidcConformityMaybeFakeSession)(grantScope, consentRequest, session),
                                // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
                                grant_access_token_audience: consentRequest.requested_access_token_audience,
                                // This tells hydra to remember this consent request and allow the same client to request the same
                                // scopes from the same user, without showing the UI, in the future.
                                remember: Boolean(req.body.remember),
                                // When this "remember" session expires, in seconds. Set this to 0 so it will never expire.
                                remember_for: 3600,
                            },
                        })
                        // All we need to do now is to redirect the user back to hydra!
                    ];
                case 1:
                    redirect_to = (_a.sent()).redirect_to;
                    // All we need to do now is to redirect the user back to hydra!
                    console.log("Redirecting back to %s", redirect_to);
                    res.redirect(String(redirect_to));
                    return [2 /*return*/];
            }
        });
    }); })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next);
    // label:docs-accept-consent
});
exports.default = router;
