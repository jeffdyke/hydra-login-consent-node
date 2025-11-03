
import {createProxyMiddleware} from "http-proxy-middleware"
import jsonLogger from "../logging.js"
import redis from "./redis.js"
import { Request } from "express"
import { appConfig } from "../config.js"
import { TaskEither } from "fp-ts/lib/TaskEither.js"
import { AppError } from '../fp/errors.js'
import * as z from "zod";
import { RedisService } from '../fp/services/redis.js'
import { ProxyParams } from "../fp/validation.js"
import { pipe } from 'fp-ts/function'

const proxyOptions = {
  target: appConfig.hydraInternalUrl,
  changeOrigin: true,
  prependPath: false,
  logger:jsonLogger,
  pathRewrite: (path: string, req: Request) => {
    const parsed = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
    if (parsed.pathname == "/oauth2/auth") {
      pipe(
        ProxyParams.safeParse()
      )

      const sessionId = crypto.randomUUID()
      req.session.pkceKey = req.session.pkceKey || sessionId
      const {
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        scope
        } = req.query;



        redis.set(`pkce_session:${req.session.pkceKey}`, JSON.stringify({
          code_challenge,
          code_challenge_method,
          client_id,
          redirect_uri,
          scope,
          state,
          timestamp: Date.now()
        }))
        .catch(err => {
          jsonLogger.error("Failed to set redis key", {key:`pkce_session:${req.session.pkceKey}`, error:err})
        });

      const queryString = new URLSearchParams(parsed.searchParams.toString());
      queryString.delete("code_challenge")
      queryString.delete("code_challenge_method")
      queryString.set("state", req.session.id)
      const returnPath = [parsed.pathname,queryString].join("?")
      jsonLogger.info("Proxy complete: Sending to hydra, session id is set to be state")
      return returnPath
    }
  }
}

export default createProxyMiddleware(proxyOptions)
