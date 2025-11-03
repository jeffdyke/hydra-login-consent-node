import { Configuration } from "@ory/hydra-client-fetch";
import { OAuth2Api } from "@ory/hydra-client-fetch/dist/index.js"
import { appConfig } from "../config.js";

const baseOptions: any = {}
if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}
const configuration = new Configuration({
  basePath: appConfig.hydraInternalAdmin,
  headers: baseOptions.headers,
})

const hydraAdmin = new OAuth2Api(configuration)

export default hydraAdmin
