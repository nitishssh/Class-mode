import nodemailer from "nodemailer";

const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.APP_URL || "http://localhost:5001";
const FROM = process.env.SMTP_FROM || "Class Mode Platform <no-reply@classmode.com>";

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeUrl(url: string): string {
  if (!url) return "";
  const escaped = escapeHtml(url);
  if (/^(https?:\/\/|\/|#)/i.test(escaped)) {
    return escaped;
  }
  return "#";
}

// A Masterpiece "God-Like" Premium HTML email styling wrapper
function brandEmailHtml(title: string, bodyContent: string, actionUrl?: string, actionText?: string, otpCode?: string): string {
  const otpSection = otpCode ? `
    <div style="text-align: center; margin: 36px 0;">
      <p style="font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; color: #6366f1; margin-bottom: 14px; font-weight: 800;">Secure Gatekeeper Code</p>
      <div style="display: inline-block; padding: 12px 16px; background-color: #fafbfd; border: 1px solid #eef2f6; border-radius: 24px; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.03);">
        ${otpCode.split("").map((char) => `
          <div style="display: inline-block; width: 56px; height: 64px; line-height: 64px; font-size: 34px; font-weight: 900; color: #4f46e5; background: #ffffff; border: 2px solid #e0e7ff; border-radius: 16px; margin: 0 5px; text-align: center; box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.1); font-family: 'Plus Jakarta Sans', 'Inter', monospace;">
            ${escapeHtml(char)}
          </div>
        `).join("")}
      </div>
      <p style="font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; font-size: 12px; color: #94a3b8; margin-top: 14px; font-style: italic;">This high-clearance signature key will expire in 15 minutes.</p>
    </div>
  ` : "";

  const actionButton = actionUrl && actionText ?
    '<div style="margin: 36px 0; text-align: center;">\n' +
    '  <a href="' + escapeUrl(actionUrl) + '" style="font-family: \'Plus Jakarta Sans\', \'Inter\', sans-serif; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 16px 36px; text-decoration: none; font-size: 16px; font-weight: 800; border-radius: 12px; display: inline-block; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4); letter-spacing: 0.5px;">' + escapeHtml(actionText) + '</a>\n' +
    '</div>' : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f6f8fb;
    }
  </style>
</head>
<body style="background-color: #f6f8fb; padding: 40px 10px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(79, 70, 229, 0.08), 0 0 1px 0 rgba(79, 70, 229, 0.1); border: 1px solid #eef2f6;">
    <!-- Splendid Ambient Top Banner -->
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 48px 30px; text-align: center; position: relative;">
      <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 900; color: #c7d2fe; letter-spacing: 5px; text-transform: uppercase; display: block; margin-bottom: 10px;">Frontier of Cognitive Mastery</span>
      <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">CLASS MODE</span>
    </div>
    
    <!-- Luxurious Card Body -->
    <div style="padding: 48px 48px 36px 48px;">
      <h2 style="font-family: 'Plus Jakarta Sans', sans-serif; color: #1e1b4b; font-size: 26px; font-weight: 800; margin-top: 0; margin-bottom: 24px; text-align: center; line-height: 1.35; letter-spacing: -0.5px;">${escapeHtml(title)}</h2>
      
      <div style="font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.85; color: #475569; margin-bottom: 28px;">
        ${bodyContent}
      </div>
      
      ${otpSection}
      ${actionButton}
    </div>
    
    <!-- Breathtaking Classical/Modern Footer -->
    <div style="background-color: #fafbfe; padding: 36px 48px; border-top: 1px solid #f1f5f9; text-align: center;">
      <p style="font-family: 'Playfair Display', serif; font-size: 16px; font-style: italic; font-weight: 600; color: #4f46e5; margin-top: 0; margin-bottom: 6px; line-height: 1.5;">"Education is not the filling of a pail, but the lighting of a fire."</p>
      <p style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 28px; font-weight: 700;">— William Butler Yeats</p>
      
      <p style="font-family: 'Inter', sans-serif; font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 0;">
        This email was dispatched via secure cryptographic gateway.
        <br>
        If you did not initiate this registration request, you can safely ignore this message.
        <br><br>
        &copy; 2026 Class Mode Inc. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendTeacherInvite(
  email: string,
  name: string,
  schoolName: string,
  token: string
) {
  const link = `${APP_URL}/accept-invite?token=${token}`;
  const safeName = escapeHtml(name);
  const safeSchoolName = escapeHtml(schoolName);
  const safeLink = escapeUrl(link);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You've been invited to join ${schoolName} on Class Mode`,
    html: brandEmailHtml(
      "Claim Your Pedagogical Arena",
      "Hi " + safeName + ",<br><br>Your reputation as an exceptional educator precedes you. You have been formally invited to join the distinguished academic cohort at <strong>" + safeSchoolName + "</strong> on the Class Mode platform.<br><br>Class Mode is your new command center—a workspace designed to coordinate high-engagement live classes, leverage automated student insights, and scale your pedagogical impact to unprecedented levels.<br><br>Set up your master workspace profile and step onto the frontier of modern teaching (this invitation expires in 7 days):",
      safeLink,
      "Activate Educator Dashboard"
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
  const safeStudentName = escapeHtml(studentName);
  const safeSchoolName = escapeHtml(schoolName);
  const safeClassName = escapeHtml(className);
  const safeLink = escapeUrl(link);

  await transporter.sendMail({
    from: FROM,
    to: parentEmail,
    subject: `${studentName} has been invited to join ${className} on Class Mode`,
    html: brandEmailHtml(
      "Your Academic Gate is Open",
      "Hello,<br><br>We are pleased to inform you that your student, <strong>" + safeStudentName + "</strong>, has been granted official admission to the classroom cohort <strong>\"" + safeClassName + "\"</strong> at <strong>" + safeSchoolName + "</strong> on the Class Mode platform.<br><br>Class Mode provides students with a state-of-the-art interactive study arena, tailored real-time feedback loops, and a gamified quest-like path to mastery designed to unlock their ultimate cognitive potential.<br><br>Configure their secure access profile below and witness their capabilities soar (this link expires in 7 days):",
      safeLink,
      "Initialize Student Access"
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
  const safeName = escapeHtml(name);
  const safeSchoolName = escapeHtml(schoolName);
  const safeLink = escapeUrl(link);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You've been invited as Principal of ${schoolName} on Class Mode`,
    html: brandEmailHtml(
      "Nomination to Academic Leadership",
      "Hi " + safeName + ",<br><br>You have been nominated to direct the academic vision and school culture for <strong>" + safeSchoolName + "</strong> as Principal on Class Mode.<br><br>This administrative role grants you high-clearance institutional control—empowering you to govern class structures, review school-wide performance metrics, authorize educator rosters, and direct the trajectory of your school's success.<br><br>Claim your academic leadership portal below and shape the future of your school (link expires in 7 days):",
      safeLink,
      "Command Academic Leadership"
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
  const safeName = escapeHtml(name);
  const safeSchoolName = escapeHtml(schoolName);
  const safeLink = escapeUrl(link);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You've been invited as School Administrator of ${schoolName} on Class Mode`,
    html: brandEmailHtml(
      "Institutional Workspace Authorized",
      "Hi " + safeName + ",<br><br>You have been designated as the School Administrator for <strong>" + safeSchoolName + "</strong> on the Class Mode platform.<br><br>This root-level access empowers you to govern the entire school infrastructure, manage rosters, provision secure credentials, and coordinate global parameters for both students and staff.<br><br>Activate your administration command console below to initialize the environment (link expires in 7 days):",
      safeLink,
      "Initialize Command Console"
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
  
  const safeName = escapeHtml(name);
  const safeWorkspaceName = escapeHtml(workspaceName);
  const safeLink = escapeUrl(link);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject,
    html: brandEmailHtml(
      "Invitation to Co-Create",
      "Hi " + (safeName || "there") + ",<br><br>You have been selected to join the premium <strong>" + safeWorkspaceName + "</strong> workspace on Class Mode.<br><br>Collaborate in real-time, share intellectual assets, and push the boundaries of achievement alongside an elite cohort of peers.<br><br>Configure your profile and claim your access below (link expires in 7 days):",
      safeLink,
      "Enter Workspace"
    ),
    text: `Hi ${name || "there"},\n\nYou have been invited to join ${workspaceName} on Class Mode.\n\nClick the link below to set up your account (expires in 7 days):\n${link}\n\n— The Class Mode Team`,
  });
}

export async function sendEmailVerification(email: string, name: string, token: string) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const safeName = escapeHtml(name);
  const safeLink = escapeUrl(link);
  const safeToken = escapeHtml(token);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Unlock Your Intellectual Frontier - Verify Your Email",
    html: brandEmailHtml(
      "Awaken Your Mind",
      "Hello " + (safeName || "Seeker of Knowledge") + ",<br><br>Your quest for intellectual mastery starts here. You are one step away from launching your AI-powered personalized learning command center on <strong>Class Mode</strong>.<br><br>Every epic journey of self-discovery and high-end creation begins with a single bold spark. Enter the secure 4-digit gatekeeper code below directly on your screen to authorize your credentials, or click the high-clearance verification link to activate your digital environment:",
      safeLink,
      "Authorize Workspace Access",
      safeToken
    ),
    text: `Hi ${name || "there"},\n\nYour 4-digit secure verification code is: ${token}\n\nVerify your email address to unlock your Class Mode workspace:\n${link}\n\n— The Class Mode Team`,
  });
}

export async function sendPasswordReset(email: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const safeName = escapeHtml(name);
  const safeLink = escapeUrl(link);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Reset your Class Mode password",
    html: brandEmailHtml(
      "Restore Your Command Console",
      "Hi " + (safeName || "there") + ",<br><br>We received a request to restore access to your Class Mode account. If you misplaced your credentials, click the button below to secure a new password and resume your learning path:",
      safeLink,
      "Secure New Password"
    ),
    text: `Hi ${name || "there"},\n\nReset your Class Mode password using this link:\n${link}\n\n— The Class Mode Team`,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const safeName = escapeHtml(name);
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Welcome to Class Mode! 🚀",
    html: brandEmailHtml(
      "Your Intellectual Journey Begins Now",
      "Hi " + safeName + ",<br><br>The boundaries of your potential have just been redefined. We're thrilled to welcome you to the frontier of AI-powered personalized learning.<br><br>Whether you are an administrator directing your institution, an educator lighting the fire of curiosity, or a student expanding your boundaries, Class Mode stands ready as your cognitive multiplier.<br><br>\n" +
      "      <div style=\"background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-radius: 16px; padding: 24px; margin-top: 10px; margin-bottom: 10px; border: 1px solid #e0e7ff;\">\n" +
      "        <h3 style=\"margin-top: 0; color: #1e1b4b; font-size: 17px; font-weight: 700; margin-bottom: 12px; font-family: 'Plus Jakarta Sans', sans-serif;\">Your Access Console is Primed:</h3>\n" +
      "        <ul style=\"padding-left: 20px; margin-bottom: 0; line-height: 1.8; color: #475569; font-size: 15px;\">\n" +
      "          <li>🚀 <strong>School Onboarding</strong>: Create custom classes, link grade cohorts, and launch administrative panels.</li>\n" +
      "          <li>💬 <strong>MessagePal Connection</strong>: Sync in real-time with class thread discussion workspaces.</li>\n" +
      "          <li>🧠 <strong>AI Study Arena & Evaluations</strong>: Unlock instant grading feedback and personalized question flows.</li>\n" +
      "        </ul>\n" +
      "      </div><br>\n" +
      "      Let's push the limits of what is possible in education. We are here to support you at every milestone."
    ),
    text: `Hi ${name},\n\nWelcome to Class Mode!\n\nThe boundaries of your potential have just been redefined.\n\nGet started by logging in and setting up your workspace profile.\n\n— The Class Mode Team`
  });
}
