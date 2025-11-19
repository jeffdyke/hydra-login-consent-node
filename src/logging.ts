import { createStream } from "rotating-file-stream";

const accessLogStream = createStream("hydra-headless.log", {
  interval: "1d", // Rotate daily
  path: "/var/log/hydra-headless-ts", // Directory for log files
  compress: "gzip", // (Optional) Compress rotated files
});

type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

interface LogEntry {
  message: string
  logLevel: LogLevel
  timestamp: string
  annotations: Record<string, unknown>
  spans: Record<string, unknown>
  fiberId: string
}

/**
 * JSON Logger that matches Effect's Logger.json format
 * Used for Express middleware and other non-Effect code
 */
class JsonLogger {
  private write(level: LogLevel, message: string, annotations?: Record<string, unknown>): void {
    const entry: LogEntry = {
      message,
      logLevel: level,
      timestamp: new Date().toISOString(),
      annotations: annotations ?? {},
      spans: {},
      fiberId: '#express'
    }

    const json = JSON.stringify(entry)

    // Write to stdout and file
    process.stdout.write(`${json}\n`)
    accessLogStream.write(`${json}\n`)
  }

  trace(message: string, annotations?: Record<string, unknown>): void {
    this.write('TRACE', message, annotations)
  }

  debug(message: string, annotations?: Record<string, unknown>): void {
    this.write('DEBUG', message, annotations)
  }

  info(message: string, annotations?: Record<string, unknown>): void {
    this.write('INFO', message, annotations)
  }

  warn(message: string, annotations?: Record<string, unknown>): void {
    this.write('WARN', message, annotations)
  }

  error(message: string, annotations?: Record<string, unknown>): void {
    this.write('ERROR', message, annotations)
  }

  fatal(message: string, annotations?: Record<string, unknown>): void {
    this.write('FATAL', message, annotations)
  }
}

const jsonLogger = new JsonLogger()

export default jsonLogger
