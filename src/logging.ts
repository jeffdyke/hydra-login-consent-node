import { ISettings, ILogObj, Logger } from "tslog";
import { createStream } from "rotating-file-stream";

const accessLogStream = createStream("hydra-consent.log", {
  interval: "1d", // Rotate daily
  path: "/var/log/bondlink/hydra", // Directory for log files
  compress: "gzip", // (Optional) Compress rotated files
});

const settings: Partial<ISettings<ILogObj>> = {
  type: "json",
  name: "express-main"
};
const jsonLogger = new Logger(settings)
jsonLogger.attachTransport((logO) => accessLogStream.write(JSON.stringify(logO) + "\n" ))

export default jsonLogger
