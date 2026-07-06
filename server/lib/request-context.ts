/**
 * server/lib/request-context.ts
 *
 * Per-request correlation context, backed by AsyncLocalStorage.
 *
 * Why AsyncLocalStorage instead of threading a requestId param through
 * every logger.* call site: logger.error/info/warn are already called from
 * ~280 places across routes/services/lib. AsyncLocalStorage lets the
 * requestId middleware set the ID once per request and have it picked up
 * automatically by every log line emitted anywhere in that request's async
 * call chain (including inside promises, setTimeout, etc.), with no call-site
 * changes required.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Returns the current request's correlation ID, or undefined outside a request (e.g. boot-time logs). */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
