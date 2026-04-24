/**
 * server/lib/logger.ts
 *
 * Centralized structured logging utility.
 * Provides consistent formatting for info, warn, and error levels.
 */

export const logger = {
  info: (msg: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp} - ${msg}`, meta ? JSON.stringify(meta) : "");
  },

  warn: (msg: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] ${timestamp} - ${msg}`, meta ? JSON.stringify(meta) : "");
  },

  error: (msg: string, err?: any) => {
    const timestamp = new Date().toISOString();
    const errorMessage = err instanceof Error ? err.stack || err.message : JSON.stringify(err);
    console.error(`[ERROR] ${timestamp} - ${msg}\n${errorMessage}`);
  },

  /**
   * Simple request logger middleware
   */
  requestLogger: (req: any, res: any, next: any) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api")) {
        logger.info(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  },
};
