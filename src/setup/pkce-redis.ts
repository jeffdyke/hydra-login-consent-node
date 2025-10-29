import redis from "./redis.js"
import jsonLogger from "../logging.js"
import type { Request } from "express"
import { RedisPKCE } from "./index.js"
const pkceSessionPrefix = 'pkce_session'

const fetchPkce = async function(req: Request): Promise<void | RedisPKCE> {
  const fullKey = `${pkceSessionPrefix}:${req.session.pkceKey}`
  const pkceResult = await redis.get(fullKey).then(resp => {
    jsonLogger.info("base result from redis", {raw:resp,key:`${fullKey}`})
      const asO: RedisPKCE = JSON.parse(resp || "")
      return asO
  }).catch(err => {
    jsonLogger.error("Could not locate key in redis store", {key:`${pkceSessionPrefix}:${req.session.pkceKey}`})
  })
  return pkceResult
}
export {
  fetchPkce,
  pkceSessionPrefix
}
