import express from "express"
import { googleTokenResponse } from "../google_auth.js"
import jsonLogger  from "../logging.js"
import {appConfig} from "../config.js"
import axios from "../middleware/axios.js"
import {v4} from "uuid"
import {CLIENT_ID} from "../setup/hydra.js"

const router = express.Router()

router.get("/", async (req, res) => {
  const code = req.query.code
  const returnedState = req.query.state
  const createClientId = CLIENT_ID
  jsonLogger.info("CALLBACK GET", {
    code:code,
    returnedState:returnedState,
    createClientId:createClientId,
    state:req.session.state,
    codeChallenge:req.session.codeChallenge
  })

  if (code && req.session) {
    const storedState = req.session.state
    const codeChallenge = req.session.codeChallenge
    jsonLogger.info(
      "State vs ReturnedState",{
        storedState: storedState,
        returnedState: returnedState,
        codeChallenge: codeChallenge,
      }
    )
    // TODO why doesn't this return a state
    // if (returnedState !== storedState) {
    //   res.status(400).send("State mismatch - possible CSRF attack")
    //   return
    // }
    // Not sure this should be auto generated
    let body = new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: appConfig.claudeRedirectUri,
          client_id: createClientId,
          code_verifier: codeChallenge ?? "",
          state: req.session.state ?? "",
        })
    // Exchange code for tokens WITH code_verifier
    axios.post(`${process.env.HYDRA_URL}/oauth2/token`, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then(data => {
        jsonLogger.info("Post Success", {response: data, state: req.session.state, verifier: req.session.codeChallenge})
        // Clear stored values from session
        if (req.session) {
          delete req.session.codeChallenge
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
        res.status(500).send(`Error Caught in callback: ${err.message} with body ${body}`)
      })
  } else {
    jsonLogger.info("Missing code session ", {code:code, session:JSON.stringify(req.session)})
    res.status(400).send("Missing code or session ")
  }
})

export default router
