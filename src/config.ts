// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import { Configuration, OAuth2Api } from "@ory/hydra-client-fetch"

const baseOptions: any = {}

if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}

const configuration = new Configuration({
  basePath: process.env.HYDRA_ADMIN_URL,
  accessToken: process.env.ORY_API_KEY || process.env.ORY_PAT,
  headers: baseOptions.headers
})

const HYDRA_URL = process.env.HYDRA_URL || "https://auth.staging.bondlink.org"

const hydraAdmin = new OAuth2Api(configuration)

// PostgreSQL configuration
const pgConfig = {
  user: process.env.POSTGRES_USER || "hydra",
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || "hydra",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
}

export { hydraAdmin, pgConfig, HYDRA_URL }
