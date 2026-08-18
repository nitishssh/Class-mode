import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * #322 follow-on: signup now AWAITS the verification send so it can report
 * whether the code actually went out. That promoted nodemailer's transport
 * defaults into a user-facing latency budget — 2 min to connect, 30s for the
 * greeting, 10 min of socket inactivity. An unreachable provider would hold
 * the signup request open for two minutes before answering.
 *
 * These pin the explicit timeouts. Silent removal would restore a two-minute
 * hang on the one flow #322 exists to make trustworthy.
 */

const { createTransport } = vi.hoisted(() => ({
  createTransport: vi.fn(() => ({ sendMail: vi.fn() })),
}));

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...savedEnv };
});

/** Import the mailer fresh so the module-level transporter is rebuilt. */
async function loadMailerWithSmtp() {
  process.env.SMTP_USER = "apikey";
  process.env.SMTP_PASS = "re_a_real_looking_key";
  await import("../lib/integrations/mailer");
  return createTransport.mock.calls[0][0] as Record<string, unknown>;
}

describe("#322 — the SMTP transport fails fast instead of hanging signup", () => {
  it("sets an explicit connection timeout well under the 2-minute default", async () => {
    const opts = await loadMailerWithSmtp();

    expect(opts.connectionTimeout).toBeLessThanOrEqual(30_000);
    expect(opts.connectionTimeout).toBeGreaterThan(0);
  });

  it("sets an explicit greeting timeout", async () => {
    const opts = await loadMailerWithSmtp();

    expect(opts.greetingTimeout).toBeLessThanOrEqual(30_000);
    expect(opts.greetingTimeout).toBeGreaterThan(0);
  });

  it("sets an explicit socket timeout well under the 10-minute default", async () => {
    const opts = await loadMailerWithSmtp();

    expect(opts.socketTimeout).toBeLessThanOrEqual(60_000);
    expect(opts.socketTimeout).toBeGreaterThan(0);
  });

  it("keeps the whole worst case inside a tolerable signup wait", async () => {
    const opts = await loadMailerWithSmtp();

    const worstCase =
      Number(opts.connectionTimeout) + Number(opts.greetingTimeout) + Number(opts.socketTimeout);
    expect(worstCase).toBeLessThanOrEqual(60_000);
  });
});
