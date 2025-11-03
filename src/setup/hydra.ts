import { Configuration } from "@ory/hydra-client-fetch";
import { OAuth2Api } from "@ory/hydra-client-fetch/dist/index.js"
import { appConfig } from "../config.js";
import { makeOAuth2ApiService, OAuth2ApiServiceLive } from "../api/oauth2.js";

// Legacy OAuth2Api client (kept for backwards compatibility)
const baseOptions: any = {}
if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}
const configuration = new Configuration({
  basePath: appConfig.hydraInternalAdmin,
  headers: baseOptions.headers,
})

const hydraAdmin = new OAuth2Api(configuration)

// New Effect-based OAuth2 API service
const headers: Record<string, string> = {}
if (process.env.MOCK_TLS_TERMINATION) {
  headers["X-Forwarded-Proto"] = "https"
}

export const oauth2ApiService = makeOAuth2ApiService({
  basePath: appConfig.hydraInternalAdmin,
  headers,
})

export const OAuth2ApiLayer = OAuth2ApiServiceLive({
  basePath: appConfig.hydraInternalAdmin,
  headers,
})

export default hydraAdmin
