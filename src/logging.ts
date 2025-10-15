import {$log} from "@tsed/logger";
import "@tsed/logger-file";

$log.appenders.set("console-log", {
  type: "console",
  // filename: `logs/app.log`,
  // pattern: ".yyyy-MM-dd",
  levels: ["info", "debug", "error", "warn", "trace", "fatal"]
})
//   .set("console-log", {
//   type: "console",
//   levels: ["info", "debug", "error", "warn", "trace", "fatal"],
//   layout: {
//     type: "json"
//   }
// })

export default $log
