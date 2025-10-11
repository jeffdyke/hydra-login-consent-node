"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const csurf_1 = __importDefault(require("csurf"));
const google_auth_1 = require("../google_auth");
const logging_1 = __importDefault(require("../logging"));
const csrfProtection = (0, csurf_1.default)({
    cookie: {
        sameSite: "lax",
    },
});
const router = express_1.default.Router();
const REDIRECT_URI = "https://auth.staging.bondlink.org/callback";
const CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639";
const config_1 = require("../config");
router.get("/", csrfProtection, (req, res) => {
    const code = req.query.code;
    const returnedState = req.query.state;
    logging_1.default.info("returned state %s code %s", returnedState, code);
    if (code && req.session) {
        const storedState = req.session.state;
        const codeVerifier = req.session.codeVerifier;
        logging_1.default.info("State %s vs ReturnedState: %s with Code %s", storedState, returnedState, codeVerifier);
        if (returnedState !== storedState) {
            return res.status(400).send("State mismatch - possible CSRF attack");
        }
        let body = new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: codeVerifier ?? "",
        });
        logging_1.default.info("Body is %s", body);
        // Exchange code for tokens WITH code_verifier
        fetch(`${config_1.HYDRA_URL}/oauth2/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body,
        })
            .then((r) => r.json())
            .then(data => {
            logging_1.default.info("data is %s", data);
            logging_1.default.info("State: %s, Verifier %s ", req.session.state, req.session.codeVerifier);
            // Clear stored values from session
            if (req.session) {
                delete req.session.codeVerifier;
                delete req.session.state;
            }
            const resp = (0, google_auth_1.googleTokenResponse)(code);
            let jsonOut = JSON.stringify(resp, null, 2);
            res.render('callback', {
                pageTitle: 'Callback Results',
                pageData: jsonOut
            });
            // Send response to client
            // res.send(JSON.stringify(data, null, 2))
        })
            .catch((err) => {
            res.status(500).send(`Error Caught in callback: ${err.message}`);
        });
    }
    else {
        res.status(400).send("Missing code or session");
    }
});
exports.default = router;
