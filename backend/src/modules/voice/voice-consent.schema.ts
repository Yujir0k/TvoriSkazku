import { z } from 'zod';

export const consentVersionSchema = z.object({
  version: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export const CONSENT_TEXT = `
Раздел записи голоса отключён

В текущей версии «ТвориСказку» используется только готовая студийная озвучка.
Запись и загрузка пользовательского голоса недоступны.
`;

export const CONSENT_VERSION = '1.0';

export const consentInfoSchema = z.object({
  version: z.string(),
  text: z.string(),
});

export const acceptConsentSchema = z.object({});

export const revokeConsentSchema = z.object({});
