
import dotenv from 'dotenv';
import axios from 'axios';
import qs from "querystring";
import {CollectionOf, Minimum, Property, Description} from "@tsed/schema";
import {Configuration} from "@tsed/di";
import { auth, OAuth2Client, TokenPayload } from 'google-auth-library';
import jsonLogger  from "./logging.js"
import { URLSearchParams } from 'url';
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

export class AuthClientConfig {
  @Property()
  clientId: string | undefined;
  @Property()
  clientSecret: string | undefined;
  @Property()
  redirectUri: string | undefined
  constructor(clientId?: string, clientSecret?: string, redirectUri?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

}
export class AuthorizationCodeRequest {
  @Property()
  code: string | undefined;
  @Property()
  config: AuthClientConfig | undefined;
  @Property()
  grantType: string | undefined
  constructor(code: string, config: AuthClientConfig, grantType?: string) {
    this.code = code;
    this.config = config;
    this.grantType = grantType || undefined;
  }


}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const formHeader = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
async function googleOAuthTokens(code: string): Promise<TokenPayload> {
  const authClientConfig: AuthClientConfig = new AuthClientConfig(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  const authCodeRequest: AuthorizationCodeRequest = new AuthorizationCodeRequest(code, authClientConfig, "");
  jsonLogger.info("Auth Code Request is %s", authCodeRequest);

  return await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams(convertClassToRecord(authCodeRequest)),
      { headers: formHeader }
    ).then((resp) => { jsonLogger.info("Response is %s", resp.data); return resp.data})
    .catch((err) => { jsonLogger.info("Error fetching AuthCode", JSON.stringify({
      authCodeRequest:authCodeRequest,
      error:err
    })); return err.response.data });

}

async function getGoogleUser(access_token: string, id_token: string): Promise<UserInfo> {
  const url = `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${access_token}`;
  return await axios.get(url, { headers: { Authorization: `Bearer ${id_token}` } })
    .then((resp) => { return resp.data })
    .catch((err) => { jsonLogger.info("Error % fetching access token with value %s", JSON.stringify({
      error:err,
      access_token:access_token
    })); return err.response.data
  })  ;

}
async function googleTokenResponse(code: string): Promise<GoogleTokenResponse> {
    const authClientConfig: AuthClientConfig = new AuthClientConfig(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    const urlParams = new URLSearchParams(convertClassToRecord(new AuthorizationCodeRequest(code, authClientConfig, 'authorization_code')))
    return await axios.post(
      GOOGLE_TOKEN_URL,
      urlParams,
      { headers: formHeader })
      .then((resp) => { return resp.data })
      .catch((err) => { jsonLogger.info("GoogleTokenResponse Error", JSON.stringify({
        error:err,
        code:code,
        authClientConfig:JSON.stringify(authClientConfig),
        urlParams:JSON.stringify(urlParams)
      }));
      return err.response.data
    })
  }

export { googleOAuthTokens, getGoogleUser, googleTokenResponse }
