
import { Request, Response, NextFunction } from "express";
import logger  from "../logging.js"; // Import your tslog instance

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint(); // High-resolution timer for precise timing

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

    logger.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration.toFixed(2),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    }, `Request finished: ${req.method} ${req.originalUrl}`);
  });

  next();
 }
