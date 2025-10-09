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
    const storedState = sessionStorage.getItem('state');
    const codeVerifier = sessionStorage.getItem('code_verifier');
    console.log("State %s Code %s", storedState, codeVerifier);
    if (returnedState !== storedState) {
      document.getElementById('result').innerHTML = 'State mismatch - possible CSRF attack';
    }

    // Exchange code for tokens WITH code_verifier
    fetch(`${hydraAdmin.basePath}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier  // THIS IS THE KEY ADDITION
      })
    })
    .then(r => r.json())
    .then(data => {
      console.log("data is %s", data);
      document.getElementById('result').innerHTML =
        `<pre>${JSON.stringify(data, null, 2)}</pre>`;

      // Clear stored values
      sessionStorage.removeItem('code_verifier');
      sessionStorage.removeItem('state');
    })
    .catch(err => {
      document.getElementById('result').innerHTML =
        `<pre>Error: ${err.message}</pre>`;
    });
  }
})
