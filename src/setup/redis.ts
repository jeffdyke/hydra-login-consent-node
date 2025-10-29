import {Redis} from "ioredis"
import {appConfig} from "../config.js"

const redis = new Redis({
  host: appConfig.redisHost,
  port: appConfig.redisPort,
})

export default redis
