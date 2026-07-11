import { env } from '../../config/env.js';
import { sendMail } from '../../lib/mailer.js';

const FRONTEND_URL = env.FRONTEND_ORIGIN;

export async function sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Подтвердите email — ТвориСказку',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fefcf8; border-radius: 16px;">
        <h1 style="color: #d9732b; font-size: 24px; margin-bottom: 16px;">Здравствуйте, ${escapeHtml(name)}!</h1>
        <p style="color: #4a4238; font-size: 15px; line-height: 1.6;">
          Спасибо за регистрацию в <strong>ТвориСказку</strong>. Чтобы начать пользоваться сервисом, пожалуйста, подтвердите ваш email.
        </p>
        <a href="${link}" style="display: inline-block; margin: 24px 0; padding: 14px 32px; background: #d9732b; color: #ffffff; text-decoration: none; border-radius: 40px; font-size: 15px; font-weight: 700;">
          Подтвердить email
        </a>
        <p style="color: #8a7a6a; font-size: 13px;">
          Если вы не регистрировались, просто проигнорируйте это письмо. Ссылка действует 24 часа.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: 'Восстановление пароля — ТвориСказку',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fefcf8; border-radius: 16px;">
        <h1 style="color: #d9732b; font-size: 24px; margin-bottom: 16px;">Здравствуйте, ${escapeHtml(name)}!</h1>
        <p style="color: #4a4238; font-size: 15px; line-height: 1.6;">
          Мы получили запрос на восстановление пароля для вашего аккаунта.
        </p>
        <a href="${link}" style="display: inline-block; margin: 24px 0; padding: 14px 32px; background: #d9732b; color: #ffffff; text-decoration: none; border-radius: 40px; font-size: 15px; font-weight: 700;">
          Восстановить пароль
        </a>
        <p style="color: #8a7a6a; font-size: 13px;">
          Если вы не запрашивали восстановление, просто проигнорируйте это письмо. Ссылка действует 1 час.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordChangedEmail(email: string, name: string): Promise<void> {
  await sendMail({
    to: email,
    subject: 'Пароль изменён — ТвориСказку',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fefcf8; border-radius: 16px;">
        <h1 style="color: #d9732b; font-size: 24px; margin-bottom: 16px;">Здравствуйте, ${escapeHtml(name)}!</h1>
        <p style="color: #4a4238; font-size: 15px; line-height: 1.6;">
          Пароль от вашего аккаунта был успешно изменён.
        </p>
        <p style="color: #8a7a6a; font-size: 13px;">
          Если вы не меняли пароль, немедленно обратитесь в поддержку.
        </p>
      </div>
    `,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
