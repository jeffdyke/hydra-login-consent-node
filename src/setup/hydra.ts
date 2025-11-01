import { Configuration } from "@ory/hydra-client-fetch";
import { OAuth2Api } from "@ory/hydra-client-fetch/dist/index.js"
import { DCR_MASTER_CLIENT_ID, appConfig } from "../config.js";

const baseOptions: any = {}
if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}
const configuration = new Configuration({
  basePath: appConfig.hydraInternalAdmin,
  accessToken: process.env.ORY_API_KEY || process.env.ORY_PAT,
  headers: baseOptions.headers,
})

const CLIENT_ID = DCR_MASTER_CLIENT_ID
if (!CLIENT_ID) {
  throw(`CLIENT_ID environment is not legit ${process.env.DCR_MASTER_CLIENT_ID}`)
}
const hydraAdmin = new OAuth2Api(configuration)

export {hydraAdmin, CLIENT_ID, configuration as HYDRA_CONFIG  }
