
import axios from "axios"
import { CLAUDE_CLIENT_ID } from "./config.js";
import { hydraAdmin } from "./setup/hydra.js"
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import jsonLogger from "./logging.js";
import { URLSearchParams } from "url";

class ClientCreatePost extends OAuth2Client {
  client_id: string = CLAUDE_CLIENT_ID
  client_name: string = "Claude MCP Incoming client"
  scope: string = "openid email profile offline_access"
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
    jsonLogger.info("Fetch client returned ", {resp:client})
    return client
  }).catch(err => {
    jsonLogger.info("caught an error fetch the client", {e:err.toString(), clientId:clientId})
    return err
  })
  return response
}
async function newClient(clientId:string): Promise<OAuth2Client> {
  const clientPost = new ClientCreatePost(clientId, {})
  const exists = getClient(clientId).then(clientData => {
    jsonLogger.warn("getClient is returning a client", {c:clientData,id:clientData._clientId})
    // if (!clientData) {
    //   jsonLogger.info("Could not find client", {client:clientData})
    //   hydraAdmin.createOAuth2Client({oAuth2Client:clientPost}).then(client => {
    //     jsonLogger.info("Have a new client", {id:clientId,c:client})
    //     return client
    //   })
    // } else {
    //   return clientData
    // }}).catch(err => {
    //   if (err.statusCode == 409) {
    //     jsonLogger.info("Client data already exists, find out why its missed", {clientId:clientId})
    //     return {}
    //   }
    //   jsonLogger.error("Failed to create client", {error:err})
    //   return err
      return clientData
    }).catch(err => {
      jsonLogger.info("I'M IN THE ERROR CLAUSE WITH ", {e:err})
      return err
    })
  jsonLogger.info("exists is ", {e:exists})
  return exists
}

export {newClient, getClient}
