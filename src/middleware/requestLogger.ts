
import { Request, Response, NextFunction } from "express";
import logger  from "../logging.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000;

    logger.info({
      method: req.method,
      url: req.originalUrl,
      csrfToken: req.headers["x-csrf-token"],
      statusCode: res.statusCode,
      durationMs: duration.toFixed(2),
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    }, `Request finished: ${req.method} ${req.originalUrl}`);
  });

  next();
 }
