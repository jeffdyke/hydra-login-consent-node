import express from "express"
import csrf from "csurf"

const csrfProtection = csrf({
  cookie: {
    sameSite: "lax",
  },
})
const router = express.Router()
const REDIRECT_URI = "https://auth.staging.bondlink.org/callback"
const CLIENT_ID = "d8129d9b-64d1-46ff-953b-aa3ea4608639"
import { HYDRA_URL } from "../config"
router.get("/auth/google", csrfProtection, (req, res) => {
  passport.authenticate('google', { scope: ['profile'] })
})

router.get("/", csrfProtection, (req, res) => {
  const code = req.query.code
  const returnedState = req.query.state
  console.log("returned state %s code %s", returnedState, code)

  if (code && req.session) {
    const storedState = req.session.state
    const codeVerifier = req.session.codeVerifier
    console.log(
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
    console.log("Body is %s", body)
    // Exchange code for tokens WITH code_verifier
    fetch(
      `${HYDRA_URL}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body,
      },
    )
      .then((r) => r.json())
      .then(data => {
        console.log("data is %s", data)
        console.log("State: %s, Verifier %s ", req.session.state, req.session.codeVerifier)
        // Clear stored values from session
        if (req.session) {
          delete req.session.codeVerifier
          delete req.session.state
        }
        let jsonOut = JSON.stringify(data, null, 2)
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
    res.status(400).send("Missing code or session")
  }
})
router.get("/google-auth", csrfProtection, (req, res) => {
  let auth2 = gapi.auth2.getAuthInstance();
  let profile = auth2.currentUser.get().getBasicProfile();

  const code = req.query.code
  const returnedState = req.query.state
  console.log("returned state %s code %s", returnedState, code)
})
export default router
