import { prisma } from './prisma.js';
import { PRIVACY_CONSENT_VERSION } from './privacy-constants.js';

export class PrivacyConsentRequiredError extends Error {
  constructor() {
    super('Требуется согласие родителя или законного представителя на обработку данных');
    this.name = 'PrivacyConsentRequiredError';
  }
}

export const PRIVACY_CONSENT_TEXT = `
СОГЛАСИЕ НА ОБРАБОТКУ ДАННЫХ

Сервис «ТвориСказку» предназначен для родителей и законных представителей. Сервис находится на стадии хакатон-демо.

Какие данные могут храниться:
- Аккаунт: email, имя пользователя
- Тексты сказок, настройки сказок, выбранные персонажи/профили
- Имя или псевдоним ребёнка и возрастная группа (если вы сами их указали для персонализации)

Цель обработки: генерация, сохранение и редактирование сказок в библиотеке.

Передача данных:
- Для генерации текста данные передаются в Yandex Cloud AI Studio / DeepSeek (российский контур). Для запросов к Yandex Cloud AI Studio отключается серверное логирование.
- Для озвучки может использоваться зарубежный технический сервер-ретранслятор и сервис ElevenLabs. На зарубежный сервер озвучки передаётся только очищенный текст сказки, requestId, voiceId и format. В таком тексте может оставаться имя или сказочный псевдоним ребёнка, если он используется в самой сказке для персонализации. Иные данные, кроме имени или сказочного псевдонима в тексте сказки, за границу не передаются. Перед отправкой текст автоматически проверяется: если в нём есть телефон, email, адрес, школа, документы, медицинские сведения, фамилия или отчество — озвучка для такой сказки не запускается. Зарубежный сервер работает как stateless-ретранслятор, не хранит тексты, аудио и данные пользователей.

Данные не продаются и не используются для рекламы.

Вы можете в любой момент удалить сказку или аккаунт — связанные данные будут удалены.

Хакатонное демо может быть очищено после завершения мероприятия.

ЗАПРЕЩЕНО указывать сведения, не необходимые для создания сказки:
- фамилию ребёнка, адрес проживания, телефон, email ребёнка
- школу или детский сад, документы, медицинские сведения
- точную дату рождения и иные чувствительные данные

Для персонализации можно использовать имя, псевдоним или сказочное имя ребёнка, а возраст указывать только возрастной группой.
`;

export async function acceptPrivacyConsent(userId: string): Promise<void> {
  await prisma.privacyConsent.upsert({
    where: {
      userId_consentVersion: {
        userId,
        consentVersion: PRIVACY_CONSENT_VERSION,
      },
    },
    create: {
      userId,
      consentVersion: PRIVACY_CONSENT_VERSION,
    },
    update: {
      acceptedAt: new Date(),
    },
  });
}

export async function hasAcceptedLatestConsent(userId: string): Promise<boolean> {
  const record = await prisma.privacyConsent.findUnique({
    where: {
      userId_consentVersion: {
        userId,
        consentVersion: PRIVACY_CONSENT_VERSION,
      },
    },
  });
  return record !== null;
}

export function getConsentInfo() {
  return {
    version: PRIVACY_CONSENT_VERSION,
    text: PRIVACY_CONSENT_TEXT.trim(),
  };
}
