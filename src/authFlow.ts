
import axios from "axios"
import { DCR_MASTER_CLIENT_ID } from "./config.js";
import hydraAdmin from "./setup/hydra.js"
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import jsonLogger from "./logging.js";
import { URLSearchParams } from "url";
import { OAuth2Client as OryOAuth2Client } from "@ory/client-fetch";
import { Effect, pipe, Either } from 'effect'
import { OAuth2ApiService } from './api/oauth2.js'
// import {cli}
// import { OAuth2ApiLayer } from './api/hydra.js'
// import type { HttpError } from './fp/errors.js'
import { validateCreateClient } from "./fp/validation.js";


class ClaudeClient extends OAuth2Client {
  client_id: string = DCR_MASTER_CLIENT_ID
  client_name: string = "Claude MCP Incoming client"
  scope: string = "openid email profile"
  grant_types: Array<string> = ["authorization_code", "refresh_token"]
  response_types: Array<string> = ["code"]
  redirect_urls: Array<string> = ["https://claude.ai/api/mcp/auth_callback"]
  token_endpoint_auth_method: string = "none"
  constructor(clientId: string, options: OAuth2ClientOptions) {
    super(options)
    this.client_id = clientId
  }

}

export const getClient = (clientId:string) =>
  pipe(
    OAuth2ApiService,
    Effect.map((api) => api.getClient(clientId)),
  )
export const listClients = () =>
  pipe(
    OAuth2ApiService,
    Effect.map((api) => api.listClients()),
  )

//Don't need to create clients at the moment, this needs validation to ensure duplicates are not attempted
export const createClient = (clientId:string) =>
  pipe(
    listClients(),
    Effect.flatten,
    Effect.map((clients: OryOAuth2Client[]) =>
      clients
        .map(client => client.client_id)
        .filter((id): id is string => id !== undefined)

    ),
    Effect.flatMap((clientIds: string[]) =>
      validateCreateClient(clientId, clientIds)
    )
  )
