import redis from "./redis.js"
import jsonLogger from "../logging.js"
import type { Request } from "express"
import { RedisPKCE } from "./index.js"
const pkceSessionPrefix = 'pkce_session'

const fetchPkce = async function(req: Request): Promise<RedisPKCE> {
  const fullKey = `${pkceSessionPrefix}:${req.session.pkceKey}`
  const pkceResult = await redis.get(fullKey).then(resp => {
    const asO: RedisPKCE = JSON.parse(resp || "")
    return asO
  })

  return pkceResult
}


export {
  fetchPkce,
  pkceSessionPrefix
}
