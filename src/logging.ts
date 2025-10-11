import {Logger} from "@tsed/logger";
import {StdoutAppender, StderrAppender} from "@tsed/logger-std";
import {FileAppender} from "@tsed/logger-file";
import {JsonLayout} from "@tsed/logger/layouts/JsonLayout.js";

const APP_LOG = new Logger()

  APP_LOG.appenders.set("std-log-json", {
    type: "file",
    filename: `${__dirname}/logs/app.log`,
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
