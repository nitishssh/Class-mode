/**
 * Production Content-Security-Policy directives.
 *
 * Extracted from server/index.ts so the emitted header can be asserted in a
 * test (#324.4). A source-text assertion could only prove the literal
 * `workerSrc:` appears; it could not catch a key helmet no longer honours, so
 * the security decision it guards would silently stop applying.
 */
export const productionCspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://www.gstatic.com"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  imgSrc: [
    "'self'",
    "data:",
    "https://firebasestorage.googleapis.com",
    "https://lh3.googleusercontent.com",
  ],
  connectSrc: [
    "'self'",
    "https://*.firebaseio.com",
    "https://*.googleapis.com",
    "https://*.run.app",
  ],
  // data: — the client bundle inlines a woff2 as a data URI;
  // without it the browser blocks the font on every page load.
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  // #324.4: previously unset, so workers fell through to
  // script-src and were blocked with no stated intent. Stated
  // explicitly now, and deliberately WITHOUT blob: — a blob:
  // worker source would let any XSS execute attacker-supplied
  // code in a worker. The only thing that wanted one was
  // canvas-confetti's off-main-thread mode, which we now switch
  // off at the call site (client/src/lib/confetti.ts) rather than
  // widening the policy for a decorative animation.
  workerSrc: ["'self'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
} as const;
