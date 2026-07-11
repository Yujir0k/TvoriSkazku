import { findPersonalData, hasPersonalData, DOB_PATTERN, PERSONAL_DATA_BLOCK_MESSAGE } from './personal-data-filter.js';
import { randomUUID } from 'node:crypto';

export const FOREIGN_TTS_CLEAN_MESSAGE =
  'Текст сказки содержит признаки персональных данных, которые невозможно безопасно очистить. Озвучка через внешний сервис недоступна для этой сказки.';

/**
 * Проверяет, безопасен ли текст для отправки на зарубежный TTS relay.
 * Имя ребёнка (однословное, без фамилии/отчества) допускается в тексте —
 * оно разрешено политикой для персонализации озвучки.
 * Все остальные ПДн строго блокируются.
 */
export function isSafeForForeignTts(text: string): boolean {
  if (DOB_PATTERN.test(text)) return false;
  return !hasPersonalData(text);
}

/**
 * Проверяет, содержит ли текст фамилию или полное ФИО помимо известных имён.
 * Если текст содержит <имя> <фамилия> или <имя> <отчество> или три слова подряд,
 * которые не являются просто известным именем — это ФИО.
 * 
 * Простая эвристика: если после известного имени идёт ещё одно слово с заглавной буквы —
 * это может быть фамилия/отчество.
 */
/**
 * Характерные окончания русских фамилий.
 */
const SURNAME_SUFFIXES = [
  'ов', 'ова', 'ову', 'овым', 'ове',
  'ев', 'ева', 'еву', 'евым', 'еве',
  'ин', 'ина', 'ину', 'иным', 'ине',
  'ын', 'ына', 'ыну', 'ыным', 'ыне',
  'ский', 'ская', 'ское', 'ского', 'скому', 'ским', 'ском',
  'цкий', 'цкая', 'цкое', 'цкого', 'цкому', 'цким', 'цком',
  'ской', 'ских',
  'их',
];

/**
 * Приставки отчества.
 */
const PATRONYMIC_SUFFIXES = ['вич', 'вна', 'ична', 'ич', 'чна'];

/**
 * Проверяет, содержит ли текст фамилию или ФИО помимо известных имён.
 * Использует характерные окончания русских фамилий и отчеств:
 * - <имя> <слово на -ов/-ев/-ин/-ский/> — фамилия
 * - <имя> <слово на -вич/-вна> — отчество (и значит, есть фамилия где-то рядом)
 * - <имя> <отчество> <фамилия> — полное ФИО
 */
function hasFullNameOrSurname(text: string, knownFirstNames: string[]): boolean {
  if (knownFirstNames.length === 0) return false;
  
  // Ищем слова, которые явно похожи на фамилию по окончанию
  // упрощённая, но рабочая проверка: после известного имени идёт слово,
  // заканчивающееся на характерный фамильный суффикс
  const allSuffixes = SURNAME_SUFFIXES.concat(PATRONYMIC_SUFFIXES).concat(['ева']);
  allSuffixes.sort((a, b) => b.length - a.length);
  
  for (const name of knownFirstNames) {
    const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const suffix of allSuffixes) {
      // Ищем: <известное_имя> <пробел> <слово_с_суффиксом>
      // Слово с суффиксом: любые буквы, последние |suffix| символов = suffix
      const suffixEscaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Полная проверка: имя + пробел + (буквы, кончающиеся на suffix)
      const patStr = `(^|[^\\p{L}\\p{N}_])${nameEscaped}\\s+[\\p{L}]+${suffixEscaped}(?=$|[^\\p{L}\\p{N}_])`;
      const pat = new RegExp(patStr, 'gui');
      if (pat.test(text)) return true;
    }
  }
  
  return false;
}

/**
 * Проверяет, безопасен ли текст для отправки на foreign TTS с учётом известных имён.
 * Имя ребёнка разрешено: может оставаться в тексте для озвучки.
 * Фамилия/отчество/ФИО — блокируются.
 * Все остальные ПДн — блокируются.
 */
export function isSafeForeignTtsWithNames(text: string, knownNames: string[]): boolean {
  if (!text || !text.trim()) return false;
  
  // Проверка базовых ПДн
  if (!isSafeForForeignTts(text)) return false;
  
  // Проверка фамилии/ФИО (если есть известные имена)
  if (knownNames.length > 0 && hasFullNameOrSurname(text, knownNames)) {
    return false;
  }
  
  return true;
}

/**
 * Проверяет текст перед отправкой на foreign TTS relay.
 * Имя ребёнка (из knownNames) разрешено — НЕ заменяется на нейтральное.
 * Все остальные ПДн строго блокируются: дата рождения, школа, телефон, документы,
 * адрес, медицинские данные, фамилия/отчество/ФИО.
 *
 * @returns исходный текст, если он безопасен; null если содержит запрещённые ПДн.
 */
export function sanitizeForForeignTts(
  text: string,
  namesToKeep: string[] = [],
): string | null {
  if (!text || !text.trim()) return null;

  // Шаг 1: проверка дат рождения — если есть, не отправляем
  if (DOB_PATTERN.test(text)) {
    return null;
  }

  // Шаг 2: проверка базовых ПДн (школа, телефон, документы, адрес, медицина и т.д.)
  if (hasPersonalData(text)) {
    return null;
  }

  // Шаг 3: если есть известные имена, проверяем, нет ли рядом фамилии/отчества
  if (namesToKeep.length > 0 && hasFullNameOrSurname(text, namesToKeep)) {
    return null;
  }

  return text;
}

/**
 * Собирает минимальный payload для foreign TTS relay.
 * @returns null, если текст небезопасен
 */
export function buildForeignTtsPayload(
  cleanedText: string | null,
  voiceId: string,
  namesToKeep: string[] = [],
): { requestId: string; text: string; voiceId: string; format: string } | null {
  if (!cleanedText || !cleanedText.trim()) return null;

  const safeText = sanitizeForForeignTts(cleanedText, namesToKeep);
  if (!safeText) return null;

  return {
    requestId: randomUUID(),
    text: safeText,
    voiceId,
    format: 'mp3',
  };
}

export class ForeignTtsBlockedError extends Error {
  constructor() {
    super(FOREIGN_TTS_CLEAN_MESSAGE);
    this.name = 'ForeignTtsBlockedError';
  }
}


