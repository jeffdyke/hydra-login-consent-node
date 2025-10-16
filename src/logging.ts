import { BaseLogger, ILogObjMeta, ISettings, ILogObj, Logger, IMeta, InspectOptions, TStyle } from "tslog";
const settings: Partial<ISettings<ILogObj>> = {
  type: "json",
  name: "express-main",

};

const jsonLogger = new Logger(settings);
//   .set("console-log", {
//   type: "console",
//   levels: ["info", "debug", "error", "warn", "trace", "fatal"],
//   layout: {
//     type: "json"
//   }
// })

export default jsonLogger
