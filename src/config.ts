// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { Configuration } from "@ory/hydra-client-fetch";
import { OAuth2Api } from "@ory/hydra-client-fetch/dist/index.js"
import session from "express-session"
import connectPgSimple from "connect-pg-simple"
import pool from "./pool.js"
import jsonLogger from "./logging.js"
const baseOptions: any = {}
if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}
const configuration = new Configuration({
  basePath: process.env.HYDRA_ADMIN_URL,
  accessToken: process.env.ORY_API_KEY || process.env.ORY_PAT,
  headers: baseOptions.headers,
})
const CLIENT_ID = process.env.AUTH_FLOW_CLIENT_ID || ""
if (!CLIENT_ID) {
  throw new Error("CLIENT_ID environment is not legit `{process.env.AUTH_FLOW_CLIENT_ID}`")
}
const hydraAdmin = new OAuth2Api(configuration)
// jsonLogger.info("Hydra Admin URL: %s", hydraAdmin.middleware)
// PostgreSQL configuration
// process.env is empty
const pgConfig = {
  user: process.env.POSTGRES_USER || "hydra",
  password: process.env.POSTGRES_PASSWORD || "shaken!stirred",
  database: process.env.POSTGRES_DB || "hydra",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
}

const PgStore = connectPgSimple(session)
const hasClientId = () => {
  let s = "select * from hydra_client where id = $1"
  const res = pool.query(s, [CLIENT_ID]);
  return res
}
let exists = hasClientId()
if (!exists) {
  throw new Error("clientId returned false, this is required, query failed")
} else {
  jsonLogger.info("ClientId %s", JSON.stringify(exists))
}
export { hydraAdmin, pgConfig, CLIENT_ID}
