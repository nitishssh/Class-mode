import { describe, it, expect, vi, beforeEach } from "vitest";

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

  it("stays silent on the happy path", async () => {
    await sendEmailVerification("head@school.example", "Asha", "1234");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
