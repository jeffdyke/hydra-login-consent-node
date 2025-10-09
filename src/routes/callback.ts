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

    // Exchange code for tokens WITH code_verifier
    fetch(
      `${process.env.HYDRA_ADMIN_URL || "http://127.0.0.1:4445"}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: codeVerifier ?? "",
        }),
      },
    )
      .then((r) => r.json())
      .then((data) => {
        console.log("data is %s", data)

        // Clear stored values from session
        if (req.session) {
          delete req.session.codeVerifier
          delete req.session.state
        }

        // Send response to client
        res.send(JSON.stringify(data, null, 2))
      })
      .catch((err) => {
        res.status(500).send(`Error: ${err.message}`)
      })
  } else {
    res.status(400).send("Missing code or session")
  }
})

export default router
