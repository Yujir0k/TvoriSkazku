import { z } from 'zod';

export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MAX_LENGTH = 256;
export const PASSWORD_MIN_LENGTH = 8;

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Имя обязательно для заполнения')
    .max(NAME_MAX_LENGTH, `Имя не может быть длиннее ${NAME_MAX_LENGTH} символов`),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX_LENGTH, `Email не может быть длиннее ${EMAIL_MAX_LENGTH} символов`)
    .email('Некорректный email'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`)
    .max(PASSWORD_MAX_LENGTH, `Пароль не может быть длиннее ${PASSWORD_MAX_LENGTH} символов`),
  privacyConsentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо принять согласие на обработку данных' }),
  }).optional(),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX_LENGTH, `Email не может быть длиннее ${EMAIL_MAX_LENGTH} символов`)
    .email('Некорректный email'),
  password: z.string().min(1, 'Пароль обязателен для заполнения'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Некорректный email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`)
    .max(PASSWORD_MAX_LENGTH, `Пароль не может быть длиннее ${PASSWORD_MAX_LENGTH} символов`),
});

export const updateAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Имя обязательно для заполнения')
    .max(NAME_MAX_LENGTH, `Имя не может быть длиннее ${NAME_MAX_LENGTH} символов`)
    .optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
