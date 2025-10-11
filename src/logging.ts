import {Logger} from "@tsed/logger";

const APP_LOG = new Logger()

APP_LOG.appenders.set("std-log-json", {
  type: "file",
  filename: `/var/log/hydra/app.log`,
  pattern: ".yyyy-MM-dd",
  levels: ["info", "debug", "error", "warn", "trace", "fatal"],
  layout: {
    type: "json"
  }
})

APP_LOG.appenders.set("console-log", {
  type: "console",
  levels: ["info", "debug", "error", "warn", "trace", "fatal"],
  layout: {
    type: "json"
  }
})



export default APP_LOG
