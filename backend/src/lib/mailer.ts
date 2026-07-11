import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export const transporter = nodemailer.createTransport({
  host: env.MAILPIT_HOST,
  port: env.MAILPIT_SMTP_PORT,
  secure: false,
  ignoreTLS: true,
});

const FROM_ADDRESS = 'noreply@tvoriskazku.local';
const FROM_NAME = 'ТвориСказку';

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
}
