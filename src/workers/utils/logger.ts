import { parentPort, workerData } from "node:worker_threads";
import path from "path";
import log from "electron-log/node";
import { Logger } from '../../common/utils/logger.types';

// If main passed a logsPath via workerData, write directly
if (workerData?.logsPath) {
  log.transports.file.resolvePathFn = () => path.join(workerData.logsPath, "worker.log");
}

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
  },
};
