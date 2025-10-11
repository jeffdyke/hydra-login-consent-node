import { HYDRA_URL } from './config'
import dotenv from 'dotenv';
import axios from 'axios';
import qs from "querystring";
import { auth, OAuth2Client, TokenPayload } from 'google-auth-library';
import jsonLogger  from "./logging"
dotenv.config()
export type UserInfo = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}
export const authClientConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: "https://claude.com/api/mcp/auth_callback"
    }

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const formHeader = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
async function googleOAuthTokens(code: string): Promise<TokenPayload> {

  return await axios.post(
      GOOGLE_TOKEN_URL,
      qs.stringify({...authClientConfig, code: code}),
      { headers: formHeader }
    ).then((resp) => { jsonLogger.info("Response is %s", resp.data); return resp.data})
    .catch((err) => { jsonLogger.info("Error is %s", err); return err.response.data });

}

async function getGoogleUser(access_token: string, id_token: string): Promise<UserInfo> {
  const url = `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${access_token}`;
  return await axios.get(url, { headers: { Authorization: `Bearer ${id_token}` } })
    .then((resp) => { return resp.data })
    .catch((err) => { jsonLogger.info("Error is %s", err); return err.response.data })  ;

}
async function googleTokenResponse(code: string) {
    const body = new URLSearchParams({
      code,
      client_id: authClientConfig.clientId || '',
      client_secret: authClientConfig.clientSecret || '',
      redirect_uri: authClientConfig.redirectUri || '',
      grant_type: 'authorization_code'
    })
    return await axios.post(GOOGLE_TOKEN_URL, body, { headers: formHeader })
      .then((resp) => { return resp.data })
      .catch((err) => { jsonLogger.info("Error is %s", err); return err.response.data })
  }

export { googleOAuthTokens, getGoogleUser, googleTokenResponse }
