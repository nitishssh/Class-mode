import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.APP_URL || "http://localhost:5001";
const FROM = process.env.SMTP_FROM || "Class Mode Platform <no-reply@classmode.com>";

export async function sendTeacherInvite(
  email: string,
  name: string,
  schoolName: string,
  token: string
) {
  const link = `${APP_URL}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You've been invited to join ${schoolName} on Class Mode`,
    text: `Hi ${name},

You have been invited to join ${schoolName} as a teacher on Class Mode.

Click the link below to set up your account (expires in 7 days):
${link}

If you did not expect this invite, you can ignore this email.

— The Class Mode Team`,
  });
}

export async function sendStudentInvite(
  parentEmail: string,
  studentName: string,
  schoolName: string,
  className: string,
  token: string
) {
  const link = `${APP_URL}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: parentEmail,
    subject: `${studentName} has been invited to join ${className} on Class Mode`,
    text: `Hello,

${studentName} has been invited to join the class "${className}" at ${schoolName} on Class Mode.

Click the link below to set up their account (expires in 7 days):
${link}

If you did not expect this invite, you can ignore this email.

— The Class Mode Team`,
  });
}

export async function sendPrincipalInvite(
  email: string,
  name: string,
  schoolName: string,
  token: string
) {
  const link = `${APP_URL}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You've been invited as Principal of ${schoolName} on Class Mode`,
    text: `Hi ${name},

You have been invited to join ${schoolName} as a Principal on Class Mode.

This role was assigned by a platform administrator. Click the link below to set up your account (expires in 7 days):
${link}

If you did not expect this invite, please disregard this email.

— The Class Mode Team`,
  });
}

export async function sendSchoolAdminInvite(
  email: string,
  name: string,
  schoolName: string,
  token: string
) {
  const link = `${APP_URL}/accept-invite?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You've been invited as School Administrator of ${schoolName} on Class Mode`,
    text: `Hi ${name},

You have been invited to join ${schoolName} as a School Administrator on Class Mode.

This role was assigned by a platform administrator. Click the link below to set up your account (expires in 7 days):
${link}

If you did not expect this invite, please disregard this email.

— The Class Mode Team`,
  });
}

export async function sendWorkspaceInvite(
  email: string,
  name: string,
  workspaceName: string,
  token: string,
  kind: "business_member" | "student"
) {
  const link = `${APP_URL}/accept-invite?token=${token}`;
  const subject =
    kind === "student"
      ? `You've been invited to join ${workspaceName} on Class Mode`
      : `Join ${workspaceName} on Class Mode`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject,
    text: `Hi ${name || "there"},

You have been invited to join ${workspaceName} on Class Mode.

Click the link below to set up your account (expires in 7 days):
${link}

If you did not expect this invite, you can ignore this email.

— The Class Mode Team`,
  });
}

export async function sendEmailVerification(email: string, name: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify your Class Mode email",
    text: `Hi ${name || "there"},

Verify your email address to finish setting up your Class Mode account:
${link}

This link expires soon. If you did not create this account, you can ignore this email.

— The Class Mode Team`,
  });
}

export async function sendPasswordReset(email: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your Class Mode password",
    text: `Hi ${name || "there"},

Reset your Class Mode password using this link:
${link}

If you did not request a reset, you can ignore this email.

— The Class Mode Team`,
  });
}
