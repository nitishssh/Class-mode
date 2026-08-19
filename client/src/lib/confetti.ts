import baseConfetti from "canvas-confetti";

/**
 * Confetti, with the web worker disabled.
 *
 * #324.4: canvas-confetti's default export is `confettiCannon(null, {
 * useWorker: true, resize: true })`, so every first call tries to build a
 * worker from a `blob:` URL. Our production CSP had no `worker-src`, so the
 * directive fell back to `script-src`, which does not allow `blob:` — the
 * browser blocked it and the library logged "🎊 Could not load worker" on
 * every page that fires confetti.
 *
 * The QA report proposed allowing `worker-src 'self' blob:`. That is the wrong
 * trade: a `blob:` worker source lets any XSS run attacker-supplied code in a
 * worker, and all it buys is moving a decorative animation off the main
 * thread. The library already falls back to the main thread by itself, so
 * nothing was ever visually broken — only noisy.
 *
 * We keep the CSP tight (`worker-src 'self'`, now set explicitly in
 * server/index.ts) and stop asking for a worker we have decided not to allow.
 * `resize: true` matches the default instance so behaviour is otherwise
 * identical. Import this instead of `canvas-confetti` directly.
 */
export const confetti = baseConfetti.create(undefined, {
  useWorker: false,
  resize: true,
});

export default confetti;
