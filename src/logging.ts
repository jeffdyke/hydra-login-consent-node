import { createStream } from "rotating-file-stream";
import { Logger } from "tslog";
import type { ISettings, ILogObj} from "tslog";

const accessLogStream = createStream("hydra-consent.log", {
  interval: "1d", // Rotate daily
  path: "/var/log/hydra-headless-ts", // Directory for log files
  compress: "gzip", // (Optional) Compress rotated files
});

const settings: Partial<ISettings<ILogObj>> = {
  type: "pretty",
  name: "express-main"
};
const jsonLogger = new Logger(settings)

function safeStringify(value: any): string {
  if (typeof value === 'string') {
    return value; // Already a string, return as is
  }
  try {
    return JSON.stringify(value); // Attempt to stringify other types
  } catch (error) {
    // Handle potential errors during stringification (e.g., circular references)
    jsonLogger.warn("Error during JSON.stringify")
    return String(value); // Fallback to basic string conversion
  }
}

jsonLogger.attachTransport((logO) => accessLogStream.write(`${safeStringify(logO)  }\n` ))

export default jsonLogger
