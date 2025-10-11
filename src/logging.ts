import {$log} from "@tsed/logger";
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
export default setLoggers();
