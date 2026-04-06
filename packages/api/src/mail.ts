import nodemailer from "nodemailer";
import { logger } from "./logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const from = process.env.SMTP_FROM ?? "Payment Tracker <noreply@localhost>";

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
  const url = `${baseUrl}/auth/verify?token=${token}`;

  logger.info({ email, url }, "sending magic link email");

  await transporter.sendMail({
    from,
    to: email,
    subject: "Sign in to Payment Tracker",
    text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #e2e8f0; margin: 0 0 1rem;">Payment Tracker</h2>
        <p style="color: #94a3b8; margin: 0 0 1.5rem;">Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${url}" style="display: inline-block; background: #6366f1; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500;">Sign in</a>
      </div>
    `,
  });

  logger.info({ email }, "magic link email sent");
}
