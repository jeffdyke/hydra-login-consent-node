import { ISettings, ILogObj, Logger } from "tslog";
import * as fs from "fs";
const APP_LOG_NAME="/var/log/bondlink/hydra/hydra-consent.log"
const settings: Partial<ISettings<ILogObj>> = {
  type: "json",
  name: "express-main"
};
const logStream = fs.createWriteStream(APP_LOG_NAME, { flags: "a" })
const jsonLogger = new Logger(settings);
jsonLogger.attachTransport((logObj) => {
  logStream.write(JSON.stringify(logObj) + "\n");
});

process.on("exit", () => {
  logStream.end();
});
// Create a write stream to your log file

//   .set("console-log", {
//   type: "console",
//   levels: ["info", "debug", "error", "warn", "trace", "fatal"],
//   layout: {
//     type: "json"
//   }
// })

export default jsonLogger
