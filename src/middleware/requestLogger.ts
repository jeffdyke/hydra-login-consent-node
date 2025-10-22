
import { Request, Response, NextFunction } from "express";
import logger  from "../logging.js";
import { XSRF_TOKEN_NAME } from "../config.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.locals.logData = {
    method: req.method,
    url: req.originalUrl,
    csrfToken: req.headers["x-csrf-token"],
    envXsrfToken: XSRF_TOKEN_NAME,
    ip: req.ip,
    body: req.body,
    userAgent: req.headers["user-agent"],
  }
  logger.info("Request started", res.locals.logData)
  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000;

    logger.info(`Request finished: ${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      durationMs: duration.toFixed(2),
      ...res.locals.logData
    });
  });

  next();
 }
