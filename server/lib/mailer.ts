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

// Reusable premium brand email styling helper
function brandEmailHtml(
  title: string,
  bodyContent: string,
  actionUrl?: string,
  actionText?: string
): string {
  const actionButton =
    actionUrl && actionText
      ? `
    <div style="margin: 24px 0; text-align: center;">
      <a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">${actionText}</a>
    </div>
  `
      : "";

  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #1f2937; background-color: #ffffff; border-radius: 12px; border: 1px solid #f3f4f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 800; color: #4f46e5; letter-spacing: 0.5px;">CLASS MODE</span>
      </div>
      <h1 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 16px; text-align: center;">${title}</h1>
      <div style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
        ${bodyContent}
      </div>
      ${actionButton}
      <p style="font-size: 14px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 24px; text-align: center; line-height: 1.5;">
        If you did not expect this email, you can safely ignore it.
        <br><br>
        — The Class Mode Team
      </p>
    </div>
  `;
}

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
    html: brandEmailHtml(
      `Join ${schoolName}`,
      `Hi ${name},<br><br>You have been invited to join <strong>${schoolName}</strong> as a teacher on Class Mode. Get started by setting up your profile below (link expires in 7 days):`,
      link,
      "Set Up Account"
    ),
    text: `Hi ${name},\n\nYou have been invited to join ${schoolName} as a teacher on Class Mode.\n\nClick the link below to set up your account (expires in 7 days):\n${link}\n\n— The Class Mode Team`,
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
    html: brandEmailHtml(
      "Student Class Invitation",
      `Hello,<br><br><strong>${studentName}</strong> has been invited to join the class <strong>"${className}"</strong> at <strong>${schoolName}</strong> on Class Mode.<br><br>Click below to set up their account (expires in 7 days):`,
      link,
      "Set Up Student Account"
    ),
    text: `Hello,\n\n${studentName} has been invited to join the class "${className}" at ${schoolName} on Class Mode.\n\nClick the link below to set up their account (expires in 7 days):\n${link}\n\n— The Class Mode Team`,
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
    html: brandEmailHtml(
      `Join ${schoolName} as Principal`,
      `Hi ${name},<br><br>You have been invited to join <strong>${schoolName}</strong> as the Principal on Class Mode.<br><br>This role was assigned by a platform administrator. Click below to set up your account (expires in 7 days):`,
      link,
      "Set Up Principal Account"
    ),
    text: `Hi ${name},\n\nYou have been invited to join ${schoolName} as a Principal on Class Mode.\n\nClick the link below to set up your account (expires in 7 days):\n${link}\n\n— The Class Mode Team`,
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
    html: brandEmailHtml(
      "Join as School Administrator",
      `Hi ${name},<br><br>You have been invited to join <strong>${schoolName}</strong> as a School Administrator on Class Mode.<br><br>This role was assigned by a platform administrator. Click below to set up your account (expires in 7 days):`,
      link,
      "Set Up Admin Account"
    ),
    text: `Hi ${name},\n\nYou have been invited to join ${schoolName} as a School Administrator on Class Mode.\n\nClick the link below to set up your account (expires in 7 days):\n${link}\n\n— The Class Mode Team`,
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
    html: brandEmailHtml(
      "Join Workspace",
      `Hi ${name || "there"},<br><br>You have been invited to join the <strong>${workspaceName}</strong> workspace on Class Mode.<br><br>Click the button below to configure your credentials and join (link expires in 7 days):`,
      link,
      "Join Workspace"
    ),
    text: `Hi ${name || "there"},\n\nYou have been invited to join ${workspaceName} on Class Mode.\n\nClick the link below to set up your account (expires in 7 days):\n${link}\n\n— The Class Mode Team`,
  });
}

export async function sendEmailVerification(email: string, name: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Verify your Class Mode email",
    html: brandEmailHtml(
      "Verify Your Email",
      `Hi ${name || "there"},<br><br>Verify your email address to finish setting up your Class Mode account and unlock full workspace privileges:`,
      link,
      "Verify Email Address"
    ),
    text: `Hi ${name || "there"},\n\nVerify your email address to finish setting up your Class Mode account:\n${link}\n\n— The Class Mode Team`,
  });
}

export async function sendPasswordReset(email: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your Class Mode password",
    html: brandEmailHtml(
      "Reset Your Password",
      `Hi ${name || "there"},<br><br>You requested a password reset for your Class Mode account. Click the button below to secure a new password:`,
      link,
      "Reset Password"
    ),
    text: `Hi ${name || "there"},\n\nReset your Class Mode password using this link:\n${link}\n\n— The Class Mode Team`,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Welcome to Class Mode! 🚀",
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #1f2937; background-color: #ffffff; border-radius: 12px; border: 1px solid #f3f4f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 20px; font-weight: 800; color: #4f46e5; letter-spacing: 0.5px;">CLASS MODE</span>
        </div>
        <h1 style="color: #4f46e5; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 16px; text-align: center;">Welcome to Class Mode, ${name}! 🎉</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
          We're thrilled to have you join our AI-powered personalized learning platform. Whether you are an administrator setting up your school, a teacher hosting live classes, or a student expanding your boundaries, Class Mode is built to guide your success.
        </p>
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #f3f4f6;">
          <h3 style="margin-top: 0; color: #111827; font-size: 16px; font-weight: 600;">What's Next?</h3>
          <ul style="padding-left: 20px; margin-bottom: 0; line-height: 1.8; color: #4b5563;">
            <li>🚀 Set up your workspace or school profile</li>
            <li>💬 Join real-time class chats with MessagePal</li>
            <li>🧠 Explore AI-powered study tools and evaluations</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; margin-top: 24px; text-align: center; line-height: 1.5;">
          If you have any questions, our support team is always here to help. Just reply to this email!
          <br><br>
          — The Class Mode Team
        </p>
      </div>
    `,
    text: `Hi ${name},\n\nWelcome to Class Mode!\n\nWe're thrilled to have you join our AI-powered personalized learning platform.\n\nGet started by logging in and setting up your workspace profile.\n\n— The Class Mode Team`,
  });
}
