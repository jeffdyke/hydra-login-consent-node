 // Handle callback
 import express from "express"
import url from "url"
import urljoin from "url-join"
import csrf from "csurf"
import { hydraAdmin } from "../config"
import { oidcConformityMaybeFakeSession } from "./stub/oidc-cert"
import { AcceptOAuth2ConsentRequestSession } from "@ory/hydra-client-fetch"

const csrfProtection = csrf({
  cookie: {
    sameSite: "lax",
  },
})
const router = express.Router()
const REDIRECT_URI = "https://auth.staging.bondlink.org/callback";
const CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639";
router.get("/", (req, res) => {

  const code = req.query.code;
  const returnedState = req.query.state;
  console.log("returned state %s code %s", returnedState, code);
  if (code) {
    const storedState = localStorage.getItem('state');
    const codeVerifier = localStorage.getItem('code_verifier');
    console.log("State %s vs ReturnedState: %s with Code %s", storedState, returnedState, codeVerifier);
    let elem = document.createElement("result")
    if (returnedState != storedState) {
      elem.innerHTML = 'State mismatch - possible CSRF attack';
    }

    // Exchange code for tokens WITH code_verifier
    fetch(`${process.env.HYDRA_ADMIN_URL || "http://127.0.0.1:4445"}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: <string>code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: <string>codeVerifier  // THIS IS THE KEY ADDITION
      })
    })
    .then(r => r.json())
    .then(data => {
      console.log("data is %s", data);

      elem.innerHTML =
        `<pre>${JSON.stringify(data, null, 2)}</pre>`;

      // Clear stored values
      localStorage.removeItem('code_verifier');
      localStorage.removeItem('state');
    })
    .catch(err => {
      elem.innerHTML =
        `<pre>Error: ${err.message}</pre>`;
    });
  }
})
export default router;
