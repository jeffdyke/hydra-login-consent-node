import {$log} from "@tsed/logger";
import "@tsed/logger-file";
import "@tsed/logger-std";
$log.appenders.set("stdout", {
    type: "stdout",
    levels: ["info", "debug", "error", "warn", "trace", "fatal"],
    layout: {
      type: "text"
    }
  });
//   .set("console-log", {
//   type: "console",
//   levels: ["info", "debug", "error", "warn", "trace", "fatal"],
//   layout: {
//     type: "json"
//   }
// })

export default $log
