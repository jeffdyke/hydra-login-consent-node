
import dotenv from 'dotenv';
import axios from "./middleware/axios.js"

import { Property } from "@tsed/schema";
import {Configuration} from "@tsed/di";
import {OAuth2Client, TokenPayload } from 'google-auth-library';
import jsonLogger  from "./logging.js"
import { CLAUDE_REDIRECT_URL } from './authFlow.js';
import {appConfig, CLAUDE_CLIENT_ID} from "./config.js"
dotenv.config()

Configuration({
  jsonMapper: {
    additionalProperties: false,
    disableUnsecureConstructor: false,
    strictGroups: false
  }
})
export class UserInfo {
  @Property()
  id: string | undefined;
  @Property()
  email: string | undefined;
  @Property()
  verified_email: boolean | undefined;
  @Property()
  name: string | undefined;
  @Property()
  given_name: string | undefined;
  @Property()
  family_name: string | undefined;
  @Property()
  picture: string | undefined;
  @Property()
  locale: string | undefined;
}
export class GoogleTokenResponse {
  @Property()
  access_token: string | undefined;

  @Property()
  expires_in: number | undefined;

  @Property()
  scope: string | undefined;

  @Property()
  token_type: string | undefined;

  @Property()
  id_token?: string; // Optional: Present if OpenID Connect scopes are requested

  @Property()
  refresh_token?: string; // Optional: Present if offline access is requested
}
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const formHeader = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
const client = new OAuth2Client({
    clientId: appConfig.googleClientId,
    clientSecret: appConfig.googleClientSecret,
    // this is for a middleware callback
    redirectUri: appConfig.middlewareRedirectUri
  })

async function googleAuthUrl(scope: string, incomingState: string, redirectUrl: string = CLAUDE_REDIRECT_URL): Promise<string> {
  const authUri = await client.generateAuthUrl({
    access_type:'offline',
    scope: scope,
    prompt: 'consent',
    state: incomingState,
    response_type: "code",
    redirect_uri: redirectUrl
  })
  jsonLogger.info("Auth URL", {authUrl:authUri})
  return authUri
}
async function googleOAuthTokens(code: string, redirectUrl:string = CLAUDE_REDIRECT_URL): Promise<TokenPayload> {

  const params = {code: code, client_id: CLAUDE_CLIENT_ID, redirect_url: redirectUrl, grant_type:"authorization_code"}
  jsonLogger.info("Auth Token Request", {request: params});

  return await axios.post(
      GOOGLE_TOKEN_URL,
      params,
      { headers: formHeader }
    ).then((resp) => { jsonLogger.info("Response is %s", resp.data); return resp.data})
    .catch((err) => { jsonLogger.error("Error fetching AuthCode", {
      authCodeRequest:params,
      error:err
    }); return err.response.data });

}


async function getGoogleUser(access_token: string, id_token: string): Promise<UserInfo> {
  const url = `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${access_token}`;
  jsonLogger.info("Calling google at url: %s", url)
  return await axios.get(url, { headers: { Authorization: `Bearer ${id_token}` } })
    .then((resp) => { return resp.data })
    .catch((err) => { jsonLogger.error("Access token failed for user", {
        error:err,
        access_token:access_token
      }); return err.response.data
  })  ;

}
async function googleTokenResponse(code: string, redirectUrl: string = CLAUDE_REDIRECT_URL): Promise<GoogleTokenResponse> {
    jsonLogger.info("Calling googleTokenResponse with args", {code:code, redirectUrl:redirectUrl})
    const authClientConfig: OAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUrl
    )

    const params = {code: code, grant_type: 'authorization_code'}
    jsonLogger.info("Requesting TokenResponse",  {auth:authClientConfig, params:params})
    const tokenResponse = await axios.post(
      GOOGLE_TOKEN_URL,
      params,
      { headers: formHeader })
      .then((resp) => {
        return resp.data
      })
      .catch((err) => {
        jsonLogger.info("GoogleTokenResponse Error",  {
          error:err,
          code:code,
          authClientConfig:authClientConfig,
          urlParams:params
        });
        return err.response.data
      })
    jsonLogger.info("result from token request", {resp:tokenResponse})
    return tokenResponse
  }

export { googleOAuthTokens, getGoogleUser, googleTokenResponse, googleAuthUrl }
