import {$log} from "@tsed/logger";
import {Logger} from "tslog";
const jsonLogger = new Logger({type: "json"})
const setLoggers = () => {
  $log.appenders.set("stdout", {
    type: "file",
    filename: "logs/stdout.log",
    levels: ["info", "debug", "error", "warn", "trace", "fatal"],
    layout: {
      type: "json"
    }
  });
  $log.appenders.set("stderr", {
    levels: ["trace", "fatal", "error", "warn"],
    type: "file",
    filename: "logs/stderr.log",
    layout: {
      type: "json"
    }
  });

}
setLoggers();
export default jsonLogger;
