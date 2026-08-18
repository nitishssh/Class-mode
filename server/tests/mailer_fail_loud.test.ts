import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Regression cover for #322: a dead Resend key made every signup fail while the
// product reported success — nothing above warn was logged, and the resend
// endpoint reported the SMTP failure to users as "Not authenticated".
//
// Mock nodemailer at the module boundary so no real transporter is constructed.
const { mockSendMail } = vi.hoisted(() => ({ mockSendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../lib/logger", () => ({ logger: mockLogger }));

import {
  EmailDeliveryError,
  sendEmailVerification,
  sendTeacherInvite,
} from "../lib/integrations/mailer";

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMail.mockResolvedValue({ messageId: "test" });
});

describe("email delivery failures are loud", () => {
  it("throws EmailDeliveryError when the provider rejects the send", async () => {
    mockSendMail.mockRejectedValue(new Error("Invalid `API key`"));

    await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow(
      EmailDeliveryError
    );
  });

  it("logs at error level, not warn, so a dead key surfaces in prod", async () => {
    mockSendMail.mockRejectedValue(new Error("401 API key is invalid"));

    await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "[mailer] Delivery failed",
      expect.objectContaining({
        mailType: "email_verification",
        to: "head@school.example",
      })
    );
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Delivery failed"),
      expect.anything()
    );
  });

  it("tags the failure with the mail type so triage knows what broke", async () => {
    mockSendMail.mockRejectedValue(new Error("connection refused"));

    await expect(
      sendTeacherInvite("teacher@school.example", "Ravi", "Sunrise Public", "tok")
    ).rejects.toMatchObject({ mailType: "teacher_invite", kind: "email_delivery_failed" });
  });

  it("never puts SMTP credentials in the log payload", async () => {
    process.env.SMTP_PASS = "re_super_secret_key";
    mockSendMail.mockRejectedValue(new Error("401 API key is invalid"));

    await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

    const logged = JSON.stringify(mockLogger.error.mock.calls);
    expect(logged).not.toContain("re_super_secret_key");
    delete process.env.SMTP_PASS;
  });

  // We do not control what a provider echoes back. If it quotes the failing
  // credential, that text must not reach Cloud Logging verbatim.
  it("redacts the credential when the provider echoes it back", async () => {
    process.env.SMTP_PASS = "re_super_secret_key";
    mockSendMail.mockRejectedValue(new Error("auth failed for key re_super_secret_key"));

    await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

    const logged = JSON.stringify(mockLogger.error.mock.calls);
    expect(logged).not.toContain("re_super_secret_key");
    expect(logged).toContain("[redacted]");
    delete process.env.SMTP_PASS;
  });

  // The redaction guard bails out when there is no usable secret. Both exits
  // must leave the provider's text intact — a blank or one-character SMTP_PASS
  // that split() on would shred every message into "[redacted]" noise and
  // destroy the diagnostic the error-level log exists to carry.
  it("leaves the provider message intact when no SMTP_PASS is set", async () => {
    delete process.env.SMTP_PASS;
    mockSendMail.mockRejectedValue(new Error("connection refused by smtp.example"));

    await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

    const logged = JSON.stringify(mockLogger.error.mock.calls);
    expect(logged).toContain("connection refused by smtp.example");
    expect(logged).not.toContain("[redacted]");
  });

  it("does not shred the message when SMTP_PASS is too short to be a real secret", async () => {
    process.env.SMTP_PASS = "abc";
    mockSendMail.mockRejectedValue(new Error("abc host abc refused abc"));

    await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

    const logged = JSON.stringify(mockLogger.error.mock.calls);
    expect(logged).toContain("abc host abc refused abc");
    expect(logged).not.toContain("[redacted]");
    delete process.env.SMTP_PASS;
  });

  // #322's original bug was "configured provider refuses the send". Missing
  // configuration was a second, quieter path to the same user experience: the
  // module falls back to a jsonTransport mock that RESOLVES, so signup would
  // report verificationEmailSent: true for a code that went nowhere — and log
  // the plaintext OTP while doing it.
  describe("unconfigured SMTP in production is a delivery failure, not a success", () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedUser = process.env.SMTP_USER;
    const savedPass = process.env.SMTP_PASS;

    afterEach(() => {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedUser === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = savedUser;
      if (savedPass === undefined) delete process.env.SMTP_PASS;
      else process.env.SMTP_PASS = savedPass;
    });

    it("throws instead of silently mocking the send", async () => {
      // The module was imported without SMTP credentials, so it is on the mock
      // transport — exactly the shape a misconfigured production deploy has.
      process.env.NODE_ENV = "production";

      await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow(
        EmailDeliveryError
      );
    });

    it("never hands the mock transport the message in production", async () => {
      process.env.NODE_ENV = "production";

      await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

      // The plaintext OTP must not reach the mock transport's log line.
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("names the missing configuration so triage is one log line", async () => {
      process.env.NODE_ENV = "production";

      await expect(sendEmailVerification("head@school.example", "Asha", "1234")).rejects.toThrow();

      const logged = JSON.stringify(mockLogger.error.mock.calls);
      expect(logged).toMatch(/not configured/i);
    });

    it("still uses the mock transport outside production, so dev keeps working", async () => {
      process.env.NODE_ENV = "development";

      await sendEmailVerification("head@school.example", "Asha", "1234");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  it("stays silent on the happy path", async () => {
    await sendEmailVerification("head@school.example", "Asha", "1234");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
