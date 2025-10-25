
import dotenv from 'dotenv';
import axios from "./middleware/axios.js"

import { Property } from "@tsed/schema";
import {Configuration} from "@tsed/di";
import {OAuth2Client, TokenPayload } from 'google-auth-library';
import jsonLogger  from "./logging.js"

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
export type StringRecord = Record<string, string>;

function convertClassToRecord(obj: any): Record<string, string> {
  const record: Record<string, string> = {};
  for (const key in obj) {
      // Ensure the property belongs to the object itself, not its prototype chain
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (typeof value === 'object' && value !== null) {
              // Handle nested objects by converting them to JSON strings
              record[key] = JSON.stringify(value);
          } else if (typeof value !== 'function') {
              // Exclude methods and convert other values to strings
              record[key] = String(value);
          }
      }
  }
  return record;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const formHeader = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
async function googleOAuthTokens(code: string): Promise<TokenPayload> {
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // this is for a middleware callback
    redirectUri: process.env.HYDRA_REDIRECT_URL
  })
  const params = {code: code, client: client}
  jsonLogger.info("Auth Code Request", {request: params});

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
async function googleTokenResponse(code: string): Promise<GoogleTokenResponse> {

    const authClientConfig: OAuth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

    const params = {code: code, grant_type: 'authorization_code'}
    jsonLogger.info("Requesting TokenResponse",  {auth:authClientConfig, params:params})
    return await axios.post(
      GOOGLE_TOKEN_URL,
      params,
      { headers: formHeader })
      .then((resp) => { return resp.data })
      .catch((err) => { jsonLogger.info("GoogleTokenResponse Error",  {
        error:err,
        code:code,
        authClientConfig:authClientConfig,
        urlParams:params
      });
      return err.response.data
    })
  }

export { googleOAuthTokens, getGoogleUser, googleTokenResponse }
