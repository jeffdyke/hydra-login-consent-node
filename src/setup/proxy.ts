import express from "express"
import {createProxyMiddleware} from "http-proxy-middleware"
import jsonLogger from "../logging.js"
import redis from "./redis.js"
import { NextFunction, Response, Request } from "express"

const proxyOptions = {
  target: process.env.HYDRA_PUBLIC_URL,
  changeOrigin: true,
  prependPath: false,
  logger:jsonLogger,
  pathRewrite: (path: string, req: Request) => {
    const parsed = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
    if (parsed.pathname == "/oauth2/auth") {
      const {
        client_id,
        redirect_uri,
        state,
        code_challenge,        // From Claude - YOU will validate this
        code_challenge_method,
        scope
      } = req.query;
      if (code_challenge != undefined && state != undefined) {
        const sessionId = req.session.pkceKey;
        if (sessionId == undefined) {
          new Error("could not find a session to set pkceSession")
          return
        }
        redis.set(`pkce_session:${sessionId}`, JSON.stringify({
          code_challenge,
          code_challenge_method,
          client_id,
          redirect_uri,
          scope,
          state,
          timestamp: Date.now()
        })).then(resp => {
          jsonLogger.info("Set redis key", {key:`pkce_session:${req.session.pkceKey}`, resp:resp})
        }).catch(err => {
          jsonLogger.error("Failed to set redis key", {key:`pkce_session:${req.session.pkceKey}`, error:err})
        });
      }
      const queryString = new URLSearchParams(parsed.searchParams.toString());
      queryString.delete("code_challenge")
      queryString.delete("code_challenge_method")
      const returnPath = [parsed.pathname,queryString].join("?")
      jsonLogger.info("sending to hydra", {path:returnPath})
      return returnPath
      }
    }
    // proxyReq.session.state = parsed.searchParams.get("state") || "StateNotFound"
    // proxyReq.session.codeVerifier = parsed.searchParams.get("code_challenge") || "ChallengeNotFound"
    // jsonLogger.info("proxy request", {state:proxyReq.session.state,challenge:proxyReq.session.codeVerifier})
}

export default createProxyMiddleware(proxyOptions)
