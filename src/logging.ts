import {Logger} from "@tsed/logger";
import {JsonLayout} from "@tsed/logger/layouts/JsonLayout.js";
const APP_LOG = new Logger()

APP_LOG.appenders.set("std-log-json", {
  type: "file",
  filename: `/var/log/hydra/app.log`,
  pattern: ".yyyy-MM-dd",
  levels: ["info", "debug", "error", "warn", "trace", "fatal"],
  layout: {
    type: JsonLayout
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
