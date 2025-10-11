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
const oidc_cert_1 = require("./stub/oidc-cert");
const logging_1 = __importDefault(require("../logging"));
// Sets up csrf protection
const csrfProtection = (0, csurf_1.default)({
    cookie: {
        sameSite: "lax",
    },
});
const router = express_1.default.Router();
router.get("/", csrfProtection, (req, res, next) => {
    // Parses the URL query
    const query = url_1.default.parse(req.url, true).query;
    logging_1.default.info("Stating /consent %s", res);
    // The challenge is used to fetch information about the consent request from ORY hydraAdmin.
    const challenge = String(query.consent_challenge);
    if (!challenge) {
        next(new Error("Expected a consent challenge to be set but received none."));
        return;
    }
    logging_1.default.info("Challenge found %s", challenge);
    // This section processes consent requests and either shows the consent UI or
    // accepts the consent request right away if the user has given consent to this
    // app before
    config_1.hydraAdmin
        .getOAuth2ConsentRequest({
        consentChallenge: challenge,
    })
        // This will be called if the HTTP request was successful
        .then((consentRequest) => {
        logging_1.default.info("Parsing consent request %s", consentRequest);
        // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
        // Any cast needed because the SDK changes are still unreleased.
        // TODO: Remove in a later version.
        if (consentRequest.skip || consentRequest.client?.skip_consent) {
            // You can apply logic here, for example grant another scope, or do whatever...
            // ...
            logging_1.default.info("Skipped consent");
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
                .then(({ redirect_to }) => {
                // All we need to do now is to redirect the user back to hydra!
                logging_1.default.info("Consent redirect %s", redirect_to);
                res.redirect(String(redirect_to));
            });
        }
        // If consent can't be skipped we MUST show the consent UI.
        logging_1.default.info("Rendering consent");
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
router.post("/", csrfProtection, (req, res, next) => {
    // The challenge is now a hidden input field, so let's take it from the request body instead
    const challenge = req.body.challenge;
    logging_1.default.info("Stating POST /consent %s", challenge);
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
            .then(({ redirect_to }) => {
            // All we need to do now is to redirect the browser back to hydra!
            res.redirect(String(redirect_to));
        })
            // This will handle any error that happens when making HTTP calls to hydra
            .catch(next));
    }
    // label:consent-deny-end
    let grantScope = req.body.grant_scope;
    logging_1.default.info("Passed deny access with scope %s", grantScope);
    if (!Array.isArray(grantScope)) {
        grantScope = [grantScope];
    }
    // The session allows us to set session data for id and access tokens
    let session = {
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
    logging_1.default.info("Fetch consent request again", { consentChallenge: challenge });
    // Let's fetch the consent request again to be able to set `grantAccessTokenAudience` properly.
    config_1.hydraAdmin
        .getOAuth2ConsentRequest({ consentChallenge: challenge })
        // This will be called if the HTTP request was successful
        .then(async (consentRequest) => {
        logging_1.default.info("Successful 2nd consent request");
        const { redirect_to } = await config_1.hydraAdmin.acceptOAuth2ConsentRequest({
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
        });
        // All we need to do now is to redirect the user back to hydra!
        logging_1.default.info("Redirecting back to %s", redirect_to);
        res.redirect(String(redirect_to));
    })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next);
    // label:docs-accept-consent
});
exports.default = router;
