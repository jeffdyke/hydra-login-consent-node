import redis from "./redis.js"
import jsonLogger from "../logging.js"
import type { Request } from "express"
import { RedisPKCE } from "./index.js"
const pkceSessionPrefix = 'pkce_session'


const pkceRedisKey = function(req: Request) {
  return `${pkceSessionPrefix}:${req.session.pkceKey}`
}
const fetchPkce = async function(req: Request): Promise<RedisPKCE> {
  const pkceResult = await redis.get(pkceRedisKey(req)).then(resp => {
    const asO: RedisPKCE = JSON.parse(resp || "")
    return asO
  })

  return pkceResult
}
async function rawPkce(req:Request): Promise<null | string> {
  const rawString = redis.get(pkceRedisKey(req))
  return rawString
}

export {
  fetchPkce,
  pkceSessionPrefix,
  rawPkce
}
