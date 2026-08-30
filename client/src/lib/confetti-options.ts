/**
 * Global options for the shared confetti instance.
 *
 * Kept in its own module, free of any `canvas-confetti` import, so a test can
 * assert the values without pulling a browser-only library into a node test
 * environment (#324.4). Without this, the suite could prove that nobody
 * imports canvas-confetti directly but not that our own wrapper still asks for
 * the worker-free configuration — flipping `useWorker` back to true inside the
 * wrapper would have passed every test and quietly restored the blocked-worker
 * console error in production.
 *
 * `resize: true` matches canvas-confetti's own default instance, so the only
 * intentional difference is the worker.
 */
export const CONFETTI_GLOBAL_OPTIONS = {
  useWorker: false,
  resize: true,
} as const;
