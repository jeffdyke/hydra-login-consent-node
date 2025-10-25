import { Configuration, CreateOAuth2ClientRequest } from "@ory/hydra-client-fetch";
import { OAuth2Api } from "@ory/hydra-client-fetch/dist/index.js"

const baseOptions: any = {}
if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}
const configuration = new Configuration({
  basePath: process.env.HYDRA_ADMIN_URL,
  accessToken: process.env.ORY_API_KEY || process.env.ORY_PAT,
  headers: baseOptions.headers,
})
const CLIENT_ID = process.env.AUTH_FLOW_CLIENT_ID || "633b91cd-550f-4b80-8d01-58a2a786c8da"
if (!CLIENT_ID) {
  throw new Error("CLIENT_ID environment is not legit `{process.env.AUTH_FLOW_CLIENT_ID}`")
}
const hydraAdmin = new OAuth2Api(configuration)

export {hydraAdmin, CLIENT_ID}
