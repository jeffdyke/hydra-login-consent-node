"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var router = express_1.default.Router();
var REDIRECT_URI = "https://auth.staging.bondlink.org/callback";
var CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639";
router.get("/", csrfProtection, function (req, res) {
    var code = req.query.code;
    var returnedState = req.query.state;
    console.log("returned state %s code %s", returnedState, code);
    if (code && req.session) {
        var storedState = req.session.state;
        var codeVerifier = req.session.codeVerifier;
        console.log("State %s vs ReturnedState: %s with Code %s", storedState, returnedState, codeVerifier);
        if (returnedState !== storedState) {
            return res.status(400).send("State mismatch - possible CSRF attack");
        }
        // Exchange code for tokens WITH code_verifier
        fetch("".concat(process.env.H || "http://127.0.0.1:4444", "/oauth2/token"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                code_verifier: codeVerifier !== null && codeVerifier !== void 0 ? codeVerifier : "",
            }),
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
            console.log("data is %s", data);
            console.log("State: %s, Verifier %s ", req.session.state, req.session.codeVerifier);
            // Clear stored values from session
            if (req.session) {
                delete req.session.codeVerifier;
                delete req.session.state;
            }
            var jsonOut = JSON.stringify(data, null, 2);
            res.render('callback', {
                pageTitle: 'Callback Results',
                pageData: jsonOut
            });
            // Send response to client
            // res.send(JSON.stringify(data, null, 2))
        })
            .catch(function (err) {
            res.status(500).send("Error Caught in callback: ".concat(err.message));
        });
    }
    else {
        res.status(400).send("Missing code or session");
    }
});
exports.default = router;
