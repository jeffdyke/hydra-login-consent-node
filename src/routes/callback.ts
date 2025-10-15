import express from "express"
import { default as csrf } from 'csurf';
import { googleTokenResponse } from "../google_auth.js"
import jsonLogger  from "../logging.js"
const csrfProtection = csrf({
  cookie: {
    sameSite: "lax",
  },
})
const router = express.Router()
const REDIRECT_URI = process.env.REDIRECT_URL || "http://192.168.1.199:3000/callback"
const CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639"

import axios from "axios"
import { json } from "body-parser";

router.get("/", csrfProtection, (req, res) => {
  const code = req.query.code
  const returnedState = req.query.state
  jsonLogger.info("returned state %s code %s", returnedState, code)

  if (code && req.session) {
    const storedState = req.session.state
    const codeVerifier = req.session.codeVerifier
    jsonLogger.info(
      "State %s vs ReturnedState: %s with Code %s",
      storedState,
      returnedState,
      codeVerifier,
    )

    if (returnedState !== storedState) {
      return res.status(400).send("State mismatch - possible CSRF attack")
    }
    let body = new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier ?? "",
        })
    jsonLogger.info("Body is %s", body)
    // Exchange code for tokens WITH code_verifier
    axios.post(`${process.env.HYDRA_URL}/oauth2/token`, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then(data => {
        jsonLogger.info("data is %s", data)
        jsonLogger.info("State: %s, Verifier %s ", req.session.state, req.session.codeVerifier)
        // Clear stored values from session
        if (req.session) {
          delete req.session.codeVerifier
          delete req.session.state
        }
        const resp = googleTokenResponse(code as string)

        let jsonOut = JSON.stringify(resp, null, 2)
        res.render(
          'callback', {
            pageTitle: 'Callback Results',
            pageData: jsonOut
          }

        )
        // Send response to client
        // res.send(JSON.stringify(data, null, 2))
      })
      .catch((err) => {
        res.status(500).send(`Error Caught in callback: ${err.message}`)
      })
  } else {
    jsonLogger.info("Missing code (%s) or session (%s)", code, JSON.stringify(req.session))
    res.status(400).send("Missing code or session ")
  }
})

export default router
