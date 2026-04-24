/**
 * Error tracking and logging service
 * In production, this would integrate with Sentry, Bugsnag, or similar
 */

interface ErrorContext {
  [key: string]: any;
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * Initialize error tracking service
   * In production, initialize Sentry or similar service here
   */
  initialize() {
    if (this.isInitialized) return;

    // TODO: Initialize Sentry
    // Sentry.init({
    //   dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    //   enableInExpoDevelopment: false,
    //   debug: __DEV__,
    // });

    this.isInitialized = true;

    if (__DEV__) {
      console.log('Error tracking initialized');
    }
  }

  /**
   * Log an error
   */
  logError(error: Error, context?: ErrorContext) {
    if (__DEV__) {
      console.error('Error:', error.message, context);
      console.error('Stack:', error.stack);
    }

    // TODO: Send to Sentry
    // Sentry.captureException(error, { extra: context });
  }

  /**
   * Log a message
   */
  logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    if (__DEV__) {
      console.log(`[${level.toUpperCase()}]`, message, context);
    }

    // TODO: Send to Sentry
    // Sentry.captureMessage(message, { level, extra: context });
  }

  /**
   * Set user context
   */
  setUser(userId: string, email?: string, username?: string) {
    if (__DEV__) {
      console.log('User context set:', { userId, email, username });
    }

    // TODO: Set Sentry user context
    // Sentry.setUser({ id: userId, email, username });
  }

  /**
   * Clear user context (on logout)
   */
  clearUser() {
    if (__DEV__) {
      console.log('User context cleared');
    }

    // TODO: Clear Sentry user context
    // Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, data?: ErrorContext) {
    if (__DEV__) {
      console.log(`[Breadcrumb] ${category}:`, message, data);
    }

    // TODO: Add Sentry breadcrumb
    // Sentry.addBreadcrumb({ message, category, data });
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance();

// Convenience functions
export function logError(error: Error, context?: ErrorContext) {
  errorTracker.logError(error, context);
}

export function logMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
  errorTracker.logMessage(message, level, context);
}

export function setUserContext(userId: string, email?: string, username?: string) {
  errorTracker.setUser(userId, email, username);
}

export function clearUserContext() {
  errorTracker.clearUser();
}

export function addBreadcrumb(message: string, category: string, data?: ErrorContext) {
  errorTracker.addBreadcrumb(message, category, data);
}
