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
const FROM = process.env.SMTP_FROM || "EduAI Platform <no-reply@eduai.app>";

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
    subject: `You've been invited to join ${schoolName} on EduAI`,
    text: `Hi ${name},

You have been invited to join ${schoolName} as a teacher on EduAI.

Click the link below to set up your account (expires in 7 days):
${link}

If you did not expect this invite, you can ignore this email.

— The EduAI Team`,
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
    subject: `${studentName} has been invited to join ${className} on EduAI`,
    text: `Hello,

${studentName} has been invited to join the class "${className}" at ${schoolName} on EduAI.

Click the link below to set up their account (expires in 7 days):
${link}

If you did not expect this invite, you can ignore this email.

— The EduAI Team`,
  });
}
