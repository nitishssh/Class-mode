import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer at the module boundary so the real transporter is never
// constructed. mailer.ts wraps this sendMail in a dev logger when SMTP creds
// are absent, but the wrapper still delegates to our spy.
const { mockSendMail } = vi.hoisted(() => ({ mockSendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

import { sendLeadNotification } from "../lib/integrations/mailer";

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMail.mockResolvedValue({ messageId: "test" });
  delete process.env.LEADS_NOTIFY_EMAIL;
  delete process.env.SMTP_USER;
});

describe("sendLeadNotification", () => {
  it("skips sending when no recipient is configured", async () => {
    await sendLeadNotification({ id: 1, name: "Asha", email: "asha@example.com" });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("emails the configured recipient with the lead's details", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "team@classmode.com";

    await sendLeadNotification({
      id: 7,
      name: "Asha Verma",
      school: "Sunrise Public School",
      email: "asha@school.example",
      phone: "+91 98765 43210",
      role: "School / Institution",
      message: "We'd like to run a pilot.",
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mail = mockSendMail.mock.calls[0][0];
    expect(mail.to).toBe("team@classmode.com");
    expect(mail.subject).toContain("Asha Verma");
    expect(mail.subject).toContain("Sunrise Public School");
    expect(mail.text).toContain("New landing-page lead #7");
    expect(mail.text).toContain("asha@school.example");
    expect(mail.html).toContain("Asha Verma");
  });

  it("falls back to SMTP_USER when LEADS_NOTIFY_EMAIL is unset", async () => {
    process.env.SMTP_USER = "smtp-user@classmode.com";

    await sendLeadNotification({ id: 2, name: "Ravi", phone: "+91 90000 00000" });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe("smtp-user@classmode.com");
  });

  it("omits fields the lead did not provide", async () => {
    process.env.LEADS_NOTIFY_EMAIL = "team@classmode.com";

    await sendLeadNotification({ id: 3, name: "Meena", phone: "+91 91111 11111" });

    const mail = mockSendMail.mock.calls[0][0];
    expect(mail.text).toContain("Phone: +91 91111 11111");
    expect(mail.text).not.toContain("School:");
    expect(mail.text).not.toContain("Email:");
  });
});
