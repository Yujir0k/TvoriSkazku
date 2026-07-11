export const PERSONAL_DATA_BLOCK_MESSAGE =
  'В тексте есть лишние персональные данные. Уберите их и попробуйте снова.';

const CYRILLIC = 'а-яё';
const WORD = `a-z${CYRILLIC}0-9`;

const EMAIL_PATTERN = /[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\s*\.\s*[a-zа-яё]{2,}/i;
const MASKED_EMAIL_PATTERN = /[a-z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\bat\b|собака)\s*[a-z0-9.-]+\s*(?:\.|\[dot\]|\(dot\)|\bdot\b|точка)\s*[a-zа-яё]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\s()._-]*){10,}/;
const SNILS_PATTERN = /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{2}\b/;
const INN_PATTERN = /\b\d{10}(?:\d{2})?\b/;
const RUSSIAN_PASSPORT_PATTERN = /\b\d{2}[\s-]?\d{2}[\s-]?\d{6}\b/;
const LONG_DIGIT_SEQUENCE_PATTERN = /\b\d[\d\s()._-]{11,}\d\b/;
export const DOB_PATTERN = /(?:дата\s+рождения|родил(?:ся|ась|ись|сясь)|рождени[ея]|рожд[её]н|born|birth\s*date)\s*[\s:.-]*\s*\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4}|\b\d{2}\.\d{2}\.(?:19|20)\d{2}\b|(?:дата\s+рождения|родил(?:ся|ась|ись|сясь)|рождени[ея]|born)\s+\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{2,4}|born\s+\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4}/i;
const DOCUMENT_LIKE_GROUPED_NUMBER_PATTERN = /\b\d{4}[\s-]+\d{5,6}\b/;
const RUSSIAN_PATRONYMIC_FULL_NAME_PATTERN =
  /\b[а-яё]{2,}\s+[а-яё]{2,}\s+[а-яё]*(?:вич|вна|ична|оглы|кызы)\b/gi;
const ADDRESS_ABBREVIATION_PATTERN = /(?:^|[^a-zа-яё0-9])(?:st|rd|ln|ave|apt|blvd|ул|кв|д)\.?\s*\d+/i;

const STRONG_DOCUMENT_COMPACT_KEYWORDS = [
  'паспорт',
  'загранпаспорт',
  'снилс',
  'инн',
  'passport',
  'pasport',
  'passportnumber',
  'passportno',
  'passportid',
  'passnumber',
  'departmentcode',
  'subdivisioncode',
  'nationalid',
  'identitycard',
  'idcard',
  'driverlicense',
  'driverslicense',
  'socialsecurity',
  'taxid',
  'snils',
  'inn',
  'zagranpasport',
  'kodpodrazdeleniya',
];

const SOFT_DOCUMENT_WORDS = [
  'серия',
  'номер',
  'выдан',
  'выдано',
  'документ',
  'удостоверение',
  'подразделение',
  'код подразделения',
  'прописка',
  'регистрация',
  'series',
  'serial',
  'number',
  'issued',
  'issued by',
  'document',
  'identity',
  'registration',
  'residence',
  'seriya',
  'seria',
  'nomer',
  'vydan',
  'vidan',
  'propiska',
  'registraciya',
  'registratsiya',
];

const SCHOOL_WORDS = [
  'школа',
  'школе',
  'школу',
  'школы',
  'школой',
  'детский сад',
  'детского сада',
  'детскому саду',
  'детском саду',
  'детсада',
  'детсаду',
  'детсаде',
  'детсад',
  'kindergarten',
  'school',
];

const MEDICAL_WORDS = [
  'диагноз',
  'диагноза',
  'болезнь',
  'болезни',
  'аллергия',
  'аллерги',
  'инвалидность',
  'диабет',
  'астма',
  'медкарта',
  'медосмотр',
  'прививк',
  'вакцинац',
  'диспансеризация',
  'диагностика',
  'терапия',
  'лечение',
  'лекарств',
  'таблетк',
  'prescription',
  'diagnosis',
  'diagnostic',
  'medical condition',
  'allergy',
  'disability',
  'diabetes',
  'asthma',
  'treatment',
  'medication',
];

function hasSchoolWithContext(text: string): boolean {
  const escapedPattern = SCHOOL_WORDS.map((w) => escapeRegExp(w.toLowerCase().replace(/ё/g, 'е'))).join('|');
  const schoolRegex = new RegExp(`(^|[^${WORD}])(${escapedPattern})([^${WORD}]|$)`, 'ig');

  let match;
  while ((match = schoolRegex.exec(text)) !== null) {
    const index = match.index;
    // Ищем в окне ±40 символов вокруг слова "школа"/"детсад"
    const fragmentAround = text.slice(Math.max(0, index - 15), index + match[0].length + 60);
    // Блокируем, если рядом:
    // - номер школы/сада: школа 57, школа №57, школа N57, школа номер 57
    // - указан класс/группа: 3 класс, в 3 классе, группа ромашка
    // - явно сказано "номер", "класс/классе/класса", "группа/группе/группы"
    // НЕ блокируем, если цифра просто есть где-то далеко ("школа волшебства и 3 желания")
    const schoolNumberPattern = /[№Nn#]\s*\d|\d{2,}|(?:^|[^a-zа-яё0-9])(?:номер|класс[аеу]?|групп[ауеы])(?:[^a-zа-яё0-9]|$)|\b(?:class|group)\b/i;
    if (schoolNumberPattern.test(fragmentAround)) {
      return true;
    }
  }
  return false;
}

const ALWAYS_ADDRESS_WORDS = [
  'адрес',
  'address',
];

const ADDRESS_WORDS_REQUIRING_NUMBER = [
  'улица',
  'проспект',
  'переулок',
  'бульвар',
  'шоссе',
  'площадь',
  'проезд',
  'дом',
  'квартира',
  'корпус',
  'строение',
  'подъезд',
  'индекс',
  'street',
  'avenue',
  'road',
  'lane',
  'boulevard',
  'building',
  'apartment',
  'postcode',
  'postal code',
  'zipcode',
  'zip code',
  'ulitsa',
  'ulica',
  'prospekt',
  'pereulok',
  'bulvar',
  'shosse',
  'ploshad',
  'proezd',
  'kvartira',
  'korpus',
  'stroenie',
  'podezd',
  'indeks',
];

function normalizeText(value: string) {
  const lower = value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  const compact = lower.replace(/[^a-zа-я0-9]+/gi, '');
  const digits = lower.replace(/\D+/g, '');

  return { lower, compact, digits };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasExactWord(text: string, word: string): boolean {
  const normalized = word.toLowerCase().replace(/ё/g, 'е');
  const pattern = new RegExp(`(^|[^${WORD}])${escapeRegExp(normalized)}([^${WORD}]|$)`, 'i');
  return pattern.test(text);
}

function hasAnyExactWord(text: string, words: string[]): boolean {
  return words.some((word) => hasExactWord(text, word));
}

function hasCompactKeyword(compact: string, keywords: string[]): boolean {
  return keywords.some((keyword) => compact.includes(keyword.replace(/ё/g, 'е')));
}

function digitCount(value: string): number {
  return value.replace(/\D+/g, '').length;
}

function hasSoftDocumentNearNumber(text: string): boolean {
  return SOFT_DOCUMENT_WORDS.some((word) => {
    const escaped = escapeRegExp(word.toLowerCase().replace(/ё/g, 'е'));
    const wordPattern = new RegExp(`(^|[^${WORD}])${escaped}([^${WORD}]|$)`, 'ig');

    return Array.from(text.matchAll(wordPattern)).some((match) => {
      const index = match.index ?? 0;
      const fragment = text.slice(Math.max(0, index - 60), index + word.length + 80);
      return digitCount(fragment) >= 4;
    });
  });
}

function hasPatronymicNameNearNumber(text: string): boolean {
  return Array.from(text.matchAll(RUSSIAN_PATRONYMIC_FULL_NAME_PATTERN)).some((match) => {
    const index = match.index ?? 0;
    const fragment = text.slice(Math.max(0, index - 80), index + match[0].length + 100);
    return digitCount(fragment) >= 4 || hasAnyExactWord(fragment, SOFT_DOCUMENT_WORDS);
  });
}

function hasAddressWithNumber(text: string): boolean {
  if (hasAnyExactWord(text, ALWAYS_ADDRESS_WORDS)) return true;
  if (ADDRESS_ABBREVIATION_PATTERN.test(text)) return true;

  return ADDRESS_WORDS_REQUIRING_NUMBER.some((word) => {
    const escaped = escapeRegExp(word.toLowerCase().replace(/ё/g, 'е'));
    const nearNumber = new RegExp(
      `(^|[^${WORD}])${escaped}([^${WORD}]|$)(?:[^\\d\\n]{0,40}\\d|\\s*[:#№.-]?\\s*\\d)`,
      'i',
    );
    const numberNear = new RegExp(
      `\\d(?:[^\\n${WORD}]{0,20}|\\s.{0,20})(^|[^${WORD}])${escaped}([^${WORD}]|$)`,
      'i',
    );
    return nearNumber.test(text) || numberNear.test(text);
  });
}

function addType(types: Set<string>, type: string, condition: boolean): void {
  if (condition) types.add(type);
}

export function findPersonalData(text: string): string[] {
  const value = String(text || '');
  if (!value.trim()) return [];

  const { lower, compact, digits } = normalizeText(value);
  const types = new Set<string>();

  const strongDocumentFound = hasCompactKeyword(compact, STRONG_DOCUMENT_COMPACT_KEYWORDS);
  const addressFound = hasAddressWithNumber(lower);

  addType(types, 'email', EMAIL_PATTERN.test(lower) || MASKED_EMAIL_PATTERN.test(lower));
  addType(types, 'phone', PHONE_PATTERN.test(lower));
  addType(types, 'snils', SNILS_PATTERN.test(lower));
  addType(types, 'inn', INN_PATTERN.test(lower));
  addType(types, 'passport-number', RUSSIAN_PASSPORT_PATTERN.test(lower));
  addType(types, 'document-word', strongDocumentFound);
  addType(types, 'document-near-number', hasSoftDocumentNearNumber(lower));
  addType(types, 'document-like-grouped-number', DOCUMENT_LIKE_GROUPED_NUMBER_PATTERN.test(lower));
  addType(types, 'name-near-number', hasPatronymicNameNearNumber(lower));
  addType(types, 'address-word', addressFound);
  addType(types, 'long-digits', LONG_DIGIT_SEQUENCE_PATTERN.test(lower) || digits.length >= 12);
  addType(types, 'dob', DOB_PATTERN.test(lower));
  // Школа/сад — блокируем только при наличии номера, №, класса или группы рядом
  addType(types, 'school', hasSchoolWithContext(lower));
  addType(types, 'medical', hasAnyExactWord(lower, MEDICAL_WORDS));

  return Array.from(types);
}

export function hasPersonalData(text: string): boolean {
  return findPersonalData(text).length > 0;
}

export function hasUnsafeNameInput(text: unknown): boolean {
  const value = String(text || '').trim();
  if (!value) return false;
  return /\d/.test(value) || hasPersonalData(value);
}

export function assertSafeNameInput(text: unknown): void {
  if (hasUnsafeNameInput(text)) {
    const error = new Error(PERSONAL_DATA_BLOCK_MESSAGE);
    error.name = 'PersonalDataError';
    throw error;
  }
}

export function assertNoPersonalData(...values: unknown[]): void {
  const combined = values
    .map((value) => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.join('\n');
      if (value && typeof value === 'object') return JSON.stringify(value);
      return '';
    })
    .join('\n');

  if (hasPersonalData(combined)) {
    const error = new Error(PERSONAL_DATA_BLOCK_MESSAGE);
    error.name = 'PersonalDataError';
    throw error;
  }
}

/**
 * Проверяет, что данные безопасны для отправки во внешний AI-провайдер.
 * Выбрасывает PersonalDataError, если найдены запрещённые персональные данные.
 * Используется перед отправкой prompt в Yandex AI Studio, TTS, генерацию иллюстраций.
 */
export function assertSafeForExternalAi(...values: unknown[]): void {
  return assertNoPersonalData(...values);
}
