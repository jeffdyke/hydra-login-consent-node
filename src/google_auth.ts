
import dotenv from 'dotenv';
import axios from 'axios';
import qs from "querystring";

dotenv.config()
import { HYDRA_URL } from './config'
export const authClientConfig = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${HYDRA_URL}/callback`,
      grant_type: "authorization_code",
    };
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const oauthToken = function(code: string) {
  let header = {
        "Content-Type": "application/x-www-form-urlencoded",
      }

    axios.post(
        GOOGLE_TOKEN_URL,
        qs.stringify({...authClientConfig, code: code}),
        { headers: header }
      ).then((resp) => { console.log("Response is %s", resp.data); return resp.data})
      .catch((err) => { console.log("Error is %s", err); return err.response.data });

  }
