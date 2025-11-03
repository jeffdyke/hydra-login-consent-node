
import axios from "axios"
import { DCR_MASTER_CLIENT_ID } from "./config.js";
import hydraAdmin from "./setup/hydra.js"
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import jsonLogger from "./logging.js";
import { URLSearchParams } from "url";
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

async function getClient(clientId: string): Promise<OAuth2Client> {
  const params = new URLSearchParams()
  params.append('id', clientId)

  const response = await hydraAdmin.getOAuth2Client({id:clientId}).then(client => {
    return client
  }).catch(err => {
    jsonLogger.error("Error retrieving client", {e:err.toString(), clientId:clientId})
    return err
  })
  return response
}

//Don't need to create clients at the moment, this needs validation to ensure duplicates are not attempted
async function newClient(clientId:string): Promise<OAuth2Client> {
  const clientPost = new ClaudeClient(clientId, {})
  const exists = await getClient(clientId)

  jsonLogger.warn("getClient is returning a client", {c:exists._clientId,id:exists})
  return exists
}

export {newClient, getClient}
