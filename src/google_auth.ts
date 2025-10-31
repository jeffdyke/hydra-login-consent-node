
import axios from "./middleware/axios.js"

import { Property } from "@tsed/schema";
import {Configuration} from "@tsed/di";
import {OAuth2Client, TokenPayload } from 'google-auth-library';
import jsonLogger  from "./logging.js"
import {appConfig} from "./config.js"

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
    redirectUri: appConfig.middlewareRedirectUri
  })

async function googleAuthUrl(scope: string, incomingState: string, redirectUrl: string = appConfig.claudeRedirectUri): Promise<string> {
  const authUri = await client.generateAuthUrl({
    access_type:'offline',
    scope: scope,
    prompt: 'consent',
    state: incomingState,
    response_type: "code",
    redirect_uri: redirectUrl
  })

  return authUri
}
async function googleOAuthTokens(code: string, redirectUrl:string = appConfig.claudeRedirectUri): Promise<TokenPayload> {

  const params = {
    code: code,
    grant_type:"authorization_code"
  }
  jsonLogger.info("Auth Token Request", {request: params});
  //update this
  const tokenResponse = await client.getToken(code)
    .then((resp) => {
      return resp
    })
    .catch((err) => {
      jsonLogger.error("Error fetching AuthCode", {
        authCodeRequest:params,
        error:err
      }
    )
    return err.response.data
  });
  return tokenResponse
}

async function googleRefreshResponse(refreshToken:string): Promise<any> {
  const params = new URLSearchParams()
  params.append("grant_type","refresh_token")
  params.append("refresh_token", refreshToken)
  params.append("client_id", appConfig.googleClientId || "")
  params.append("client_secret", appConfig.googleClientSecret || "")

  const resp = await axios.post('https://oauth2.googleapis.com/token', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }).catch((err) => {
        jsonLogger.error("Failed to fetch refresh token", params)
        return err.response.data
      });

  return resp;
  }


async function getGoogleUser(access_token: string, id_token: string): Promise<UserInfo> {
  const url = `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${access_token}`;
  jsonLogger.debug("Calling google at url", {url:url})
  return await axios.get(url, { headers: { Authorization: `Bearer ${id_token}` } })
    .then((resp) => { return resp.data })
    .catch((err) => { jsonLogger.error("Access token failed for user", {
        error:err,
        access_token:access_token
      }); return err.response.data
  })  ;

}
async function googleTokenResponse(code: string, redirectUrl: string = appConfig.claudeRedirectUri): Promise<GoogleTokenResponse> {
    jsonLogger.debug("Calling googleTokenResponse with args", {code:code, redirectUrl:redirectUrl})
    const authClientConfig: OAuth2Client = new OAuth2Client(
      appConfig.googleClientId,
      appConfig.googleClientSecret,
      redirectUrl
    )

    const params = {code: code, grant_type: 'authorization_code'}
    jsonLogger.debug("Requesting TokenResponse",  {auth:authClientConfig, params:params})
    const tokenResponse = await axios.post(
      GOOGLE_TOKEN_URL,
      params,
      { headers: formHeader })
      .then((resp) => {
        return resp.data
      })
      .catch((err) => {
        jsonLogger.error("GoogleTokenResponse Error",  {
          error:err,
          code:code,
          authClientConfig:authClientConfig,
          urlParams:params
        });
        return err.response.data
      })
    jsonLogger.debug("result from token request", {resp:tokenResponse})
    return tokenResponse
  }

export { googleOAuthTokens, getGoogleUser, googleTokenResponse, googleAuthUrl, googleRefreshResponse }
