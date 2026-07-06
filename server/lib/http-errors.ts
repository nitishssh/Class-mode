/**
 * server/lib/http-errors.ts
 *
 * A single "operational error" type routes/middleware can throw (or pass to
 * `next()`) to get a specific HTTP status + client-safe message out of the
 * centralized error handler in server/index.ts, instead of hand-rolling
 * `res.status(x).json({...})` at every call site.
 *
 * This does NOT replace the existing per-route try/catch response shapes
 * (`{ message }` / `{ error }`) used throughout server/routes/*.ts today —
 * those are unchanged. ApiError is for new/refactored code and for the
 * fallback global handler to recognize "expected" errors (bad input, auth,
 * not found, etc.) vs. genuinely unexpected 500s.
 */

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  /** Marks this as an expected/operational error (vs. a programmer error/bug). */
  readonly isOperational = true;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = "Bad request", code?: string): ApiError {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = "Authentication required", code?: string): ApiError {
    return new ApiError(401, message, code);
  }

  static forbidden(message = "Forbidden", code?: string): ApiError {
    return new ApiError(403, message, code);
  }

  static notFound(message = "Not found", code?: string): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message = "Conflict", code?: string): ApiError {
    return new ApiError(409, message, code);
  }

  static internal(message = "Internal server error", code?: string): ApiError {
    return new ApiError(500, message, code);
  }
}

/** True for our own ApiError, and for any other error that was given a status code. */
export function isOperationalError(
  err: unknown
): err is ApiError | { statusCode?: number; status?: number; isOperational?: boolean } {
  if (err instanceof ApiError) return true;
  if (err && typeof err === "object") {
    const e = err as { isOperational?: boolean; statusCode?: number; status?: number };
    return (
      e.isOperational === true || typeof e.statusCode === "number" || typeof e.status === "number"
    );
  }
  return false;
}
