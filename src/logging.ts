import {$log} from "@tsed/logger";

// $log.appenders.set("std-log-json", {
//   type: "file",
//   filename: `logs/app.log`,
//   pattern: ".yyyy-MM-dd",
//   levels: ["info", "debug", "error", "warn", "trace", "fatal"],
//   layout: {
//     type: "json"
//   }
// })
  $log.appenders.set("console-log", {
  type: "console",
  levels: ["info", "debug", "error", "warn", "trace", "fatal"],

})

export default $log
