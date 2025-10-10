"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgConfig = exports.hydraAdmin = void 0;
var hydra_client_fetch_1 = require("@ory/hydra-client-fetch");
var baseOptions = {};
if (process.env.MOCK_TLS_TERMINATION) {
    baseOptions.headers = { "X-Forwarded-Proto": "https" };
}
var configuration = new hydra_client_fetch_1.Configuration({
    basePath: process.env.HYDRA_ADMIN_URL,
    accessToken: process.env.ORY_API_KEY || process.env.ORY_PAT,
    headers: baseOptions.headers,
});
var hydraAdmin = new hydra_client_fetch_1.OAuth2Api(configuration);
exports.hydraAdmin = hydraAdmin;
// PostgreSQL configuration
var pgConfig = {
    user: process.env.POSTGRES_USER || "hydra",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || "hydra",
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
};
exports.pgConfig = pgConfig;
