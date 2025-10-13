// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { Configuration, ConfigurationParameters } from "@ory/hydra-client";
import { OAuth2Api } from "@ory/client-fetch"
const baseOptions: any = {}
baseOptions.basePath = process.env.HYDRA_ADMIN_URL || "http://localhost:4445"
baseOptions.accessToken = process.env.ORY_API_KEY || process.env.ORY_PAT

if (process.env.MOCK_TLS_TERMINATION) {
  baseOptions.headers = { "X-Forwarded-Proto": "https" }
}

const HYDRA_URL = "https://auth.staging.bondlink.org"

const hydraAdmin = new OAuth2Api(baseOptions )

// PostgreSQL configuration
const pgConfig = {
  user: process.env.POSTGRES_USER || "hydra",
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || "hydra",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
}

export { hydraAdmin, pgConfig, HYDRA_URL }
