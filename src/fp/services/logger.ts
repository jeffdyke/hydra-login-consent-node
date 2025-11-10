import { JsonLogger } from "effect-log";
export const loggerLayer = JsonLogger.layer({
  showFiberId: true,
  showTime: true,
  showSpans: true,
  messageField: "message",
});
