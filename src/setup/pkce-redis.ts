import redis from "./redis.js"
import jsonLogger from "../logging.js"
import type { Request } from "express"
import { RedisPKCE } from "./index.js"
const pkceSessionPrefix = 'pkce_session'
const authCodeStatePrefix = 'auth_code_state'

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

/**
 * Currently for parsing an arbitrary key into RedisPKCE
 *  being used for `auth_code_state` before a redirect to Claude
 * @param key string
 * @returns RedisPKCE
 */

const pkceStateByKey = async function(key:string): Promise<RedisPKCE> {
  const pkceResult = await redis.get(key).then(resp => {
    const asO: RedisPKCE = JSON.parse(resp || "")
    return asO
  })

  return pkceResult
}
async function rawPkce(req:Request): Promise<null | string> {
  const rawString = redis.get(pkceRedisKey(req))
  return rawString
}

// export class RefreshTokenMgr() {
//   async function getLogic()
// }
export {
  fetchPkce,
  pkceSessionPrefix,
  rawPkce,
  pkceRedisKey,
  pkceStateByKey
}
