
import { Request, Response, NextFunction } from "express";
import logger  from "../logging.js";
import { XSRF_TOKEN_NAME } from "../config.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const logStarts = /Claude-User|python-http/
  const stripArgs = /login.?login_challenge|consent.?consent_challenge|consent/
  res.locals.logData = {
    method: req.method,
    url: req.originalUrl,
    envXsrfToken: XSRF_TOKEN_NAME,
    // cookies: req.cookies,
    // sessionId: req.session,
    ip: req.ip,
    body: req.body,
    userAgent: req.headers["user-agent"] || "Empty UA",
    // headers: req.headers
  }
  if (req.originalUrl != "/favicon.ico" && logStarts.test(res.locals.logData.userAgent)) {
    logger.info("Started request for claude", res.locals.logData)
  }
  res.on("finish", () => {
    if (stripArgs.test(req.originalUrl)) {
      res.locals.logData.url = res.locals.logData.url.split("?")[0]
    }
    if (req.originalUrl != "/favicon.ico" || !stripArgs.test(req.originalUrl)){
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000;

      logger.info(`Request finished: ${req.method} ${req.originalUrl}`, {
        statusCode: res.statusCode,
        durationMs: duration.toFixed(2),
        csrfToken: req.headers["x-csrf-token"],
        ...res.locals.logData,
      });
    }

  });

  next();
 }
