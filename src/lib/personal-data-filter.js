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

function hasSchoolWithContext(text) {
  const escapedPattern = SCHOOL_WORDS.map(w => w.toLowerCase().replace(/ё/g, 'е').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const schoolRegex = new RegExp('(^|[^' + WORD + '])(' + escapedPattern + ')([^' + WORD + ']|$)', 'ig');
  let match;
  while ((match = schoolRegex.exec(text)) !== null) {
    const index = match.index;
    const fragmentAround = text.slice(Math.max(0, index - 15), index + match[0].length + 60);
    const schoolNumberPattern = /[№Nn#]\s*\d|\d{2,}|(?:^|[^a-zа-яё0-9])(?:номер|класс[аеу]?|групп[ауеы])(?:[^a-zа-яё0-9]|$)|\b(?:class|group)\b/i;
    if (schoolNumberPattern.test(fragmentAround)) {
      return true;
    }
  }
  return false;
}

const ALWAYS_ADDRESS_WORDS = ['адрес', 'address'];

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

function normalizeText(value) {
  const lower = String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
  return {
    lower,
    compact: lower.replace(/[^a-zа-я0-9]+/gi, ''),
    digits: lower.replace(/\D+/g, ''),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasExactWord(text, word) {
  const normalized = word.toLowerCase().replace(/ё/g, 'е');
  const pattern = new RegExp(`(^|[^${WORD}])${escapeRegExp(normalized)}([^${WORD}]|$)`, 'i');
  return pattern.test(text);
}

function hasAnyExactWord(text, words) {
  return words.some((word) => hasExactWord(text, word));
}

function hasCompactKeyword(compact, keywords) {
  return keywords.some((keyword) => compact.includes(keyword.replace(/ё/g, 'е')));
}

function digitCount(value) {
  return value.replace(/\D+/g, '').length;
}

function hasSoftDocumentNearNumber(text) {
  return SOFT_DOCUMENT_WORDS.some((word) => {
    const escaped = escapeRegExp(word.toLowerCase().replace(/ё/g, 'е'));
    const wordPattern = new RegExp(`(^|[^${WORD}])${escaped}([^${WORD}]|$)`, 'ig');

    return Array.from(text.matchAll(wordPattern)).some((match) => {
      const index = match.index || 0;
      const fragment = text.slice(Math.max(0, index - 60), index + word.length + 80);
      return digitCount(fragment) >= 4;
    });
  });
}

function hasPatronymicNameNearNumber(text) {
  return Array.from(text.matchAll(RUSSIAN_PATRONYMIC_FULL_NAME_PATTERN)).some((match) => {
    const index = match.index || 0;
    const fragment = text.slice(Math.max(0, index - 80), index + match[0].length + 100);
    return digitCount(fragment) >= 4 || hasAnyExactWord(fragment, SOFT_DOCUMENT_WORDS);
  });
}

function hasAddressWithNumber(text) {
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

export function findPersonalData(value) {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join('\n')
    : String(value || '');
  if (!text.trim()) return [];

  const { lower, compact, digits } = normalizeText(text);
  const types = new Set();

  const strongDocumentFound = hasCompactKeyword(compact, STRONG_DOCUMENT_COMPACT_KEYWORDS);
  const addressFound = hasAddressWithNumber(lower);

  if (EMAIL_PATTERN.test(lower) || MASKED_EMAIL_PATTERN.test(lower)) types.add('email');
  if (PHONE_PATTERN.test(lower)) types.add('phone');
  if (SNILS_PATTERN.test(lower)) types.add('snils');
  if (INN_PATTERN.test(lower)) types.add('inn');
  if (RUSSIAN_PASSPORT_PATTERN.test(lower)) types.add('passport-number');
  if (strongDocumentFound) types.add('document-word');
  if (hasSoftDocumentNearNumber(lower)) types.add('document-near-number');
  if (DOCUMENT_LIKE_GROUPED_NUMBER_PATTERN.test(lower)) types.add('document-like-grouped-number');
  if (hasPatronymicNameNearNumber(lower)) types.add('name-near-number');
  if (addressFound) types.add('address-word');
  if (LONG_DIGIT_SEQUENCE_PATTERN.test(lower) || digits.length >= 12) types.add('long-digits');
  if (hasSchoolWithContext(lower)) types.add('school');
  if (hasAnyExactWord(lower, MEDICAL_WORDS)) types.add('medical');

  return Array.from(types);
}

export function hasPersonalData(value) {
  return findPersonalData(value).length > 0;
}

export function hasUnsafeNameInput(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /\d/.test(text) || hasPersonalData(text);
}
