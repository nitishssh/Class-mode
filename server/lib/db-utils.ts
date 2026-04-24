/**
 * Database Utilities
 * Helper functions for database operations, query optimization, and monitoring
 */

import { logger } from "./logger";

/**
 * Pagination helper for consistent pagination across all list operations
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function getPaginationParams(options: PaginationOptions) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20)); // Max 100 items per page
  const skip = (page - 1) * limit;
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;

  return { page, limit, skip, sortOrder };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Query performance monitoring
 */
export class QueryMonitor {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  end(recordCount?: number) {
    const duration = Date.now() - this.startTime;

    if (duration > 1000) {
      logger.warn(`[DB] Slow query detected: ${this.operation}`, {
        duration: `${duration}ms`,
        recordCount,
      });
    } else if (duration > 500) {
      logger.info(`[DB] Query: ${this.operation}`, {
        duration: `${duration}ms`,
        recordCount,
      });
    }

    return duration;
  }
}

/**
 * Batch operation helper to prevent overwhelming the database
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  batchSize = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await operation(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retry helper for transient database failures
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`[DB] Operation failed, retrying (${attempt}/${maxRetries})`, {
          error: lastError.message,
          nextRetryIn: `${delay}ms`,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Cache helper for frequently accessed data
 */
export class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  private ttlMs: number;

  constructor(ttlSeconds = 300) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Database connection health checker
 */
export interface DatabaseHealth {
  connected: boolean;
  latency?: number;
  error?: string;
}

export async function checkDatabaseHealth(
  pingOperation: () => Promise<void>
): Promise<DatabaseHealth> {
  const startTime = Date.now();

  try {
    await pingOperation();
    const latency = Date.now() - startTime;

    return {
      connected: true,
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message,
    };
  }
}
