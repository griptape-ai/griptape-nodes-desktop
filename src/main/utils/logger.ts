import path from "path";
import { app } from "electron";
import log from "electron-log/main";
import { Logger } from '../../common/utils/logger.types';

// Configure output file (~/Library/Logs/<AppName>/main.log on macOS)
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath("logs"), "main.log");

log.transports.file.level =
  process.env.NODE_ENV === "development" ? "debug" : "info";

export const logger: Logger = {
  debug: (...args) => log.debug(...args),
  info: (...args) => log.info(...args),
  warn: (...args) => log.warn(...args),
  error: (...args) => log.error(...args),
  fatal: (err) => {
    if (err instanceof Error) {
      log.error("Fatal:", err.stack || err.message);
    } else {
      log.error("Fatal:", err);
    }
    // Hook: send to Sentry or another crash reporter
  },
};
