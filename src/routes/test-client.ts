import {newClient,getClient} from "../authFlow.js"
import { hydraAdmin } from "../setup/hydra.js"
import express from "express"
import {v4} from "uuid"
import jsonLogger from "../logging.js"
import { OAuth2Client } from "google-auth-library"
import { googleOAuthTokens } from "../google_auth.js"

const router = express.Router()
router.get("/", (req, res) => {
  const cId = v4()
  jsonLogger.info("Creating client", {clientId:cId})

  try {
    newClient(cId).then(client => {

      jsonLogger.info("Created client", {client: client, from:cId})
      getClient(cId).then(getC => {
        jsonLogger.info("new client", {c:getC})
      })
    })
  } catch(err) {
    jsonLogger.info("Error creating client", {error: err})
  }
  const mst = "Done with client creation ${clientId}"
  res.status(200).send(mst)
})

export default router
