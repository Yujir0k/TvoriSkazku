import { env } from '../../config/env.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionsRequestBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  reasoning_effort?: string;
}

interface ChatChoice {
  message: {
    role: string;
    content: string | null;
  };
  finish_reason: string;
}

interface ChatCompletionsResponse {
  choices?: ChatChoice[];
}

export class OpenModelError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'OpenModelError';
  }
}

export async function generateWithOpenModel(prompt: string, maxTokens?: number): Promise<string> {
  const model = `gpt://${env.YANDEX_FOLDER_ID}/${env.YANDEX_MODEL}`;

  const systemPrompt = 'Ты пишешь безопасные добрые детские сказки на русском языке для детей. Отвечай ТОЛЬКО текстом сказки — без пояснений до или после, без мета-фраз вроде "Вот сказка", "Вот и вся история", "Конец", "Надеюсь, тебе понравилось". Никакой markdown-разметки, заголовков, звёздочек. Только чистый повествовательный текст без авторских отступлений.\n\nВАЖНЫЕ ПРАВИЛА БЕЗОПАСНОСТИ:\n1. Никогда не включай в сказку реальные персональные данные: паспортные данные, номера документов, телефоны, email, адреса, школы или детские сады с номерами/классами/группами, медицинские диагнозы, сведения о здоровье, точные даты рождения.\n2. Если пользователь передал такие данные, игнорируй их и заменяй безопасными художественными обобщениями (например, "волшебная школа", "старый замок", "далёкая страна").\n3. Не генерируй реалистичные идентификаторы, похожие на паспорт, СНИЛС, телефон, email, адрес или номер школы.\n4. Имя ребёнка используй только как сказочное обращение, но при этом текст с именем должен быть безопасным для озвучки — не используй имя как обязательную часть сюжета.\n5. Предпочитай нейтральные роли: "герой", "героиня", "юный путешественник", "маленькая волшебница" и т.д.';

  const body: ChatCompletionsRequestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.6,
    max_tokens: maxTokens ?? env.YANDEX_MAX_TOKENS,
    reasoning_effort: 'none',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.YANDEX_TIMEOUT_MS);

  try {
    const response = await fetch('https://ai.api.cloud.yandex.net/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${env.YANDEX_API_KEY}`,
        'x-folder-id': env.YANDEX_FOLDER_ID,
        'x-data-logging-enabled': 'false',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new OpenModelError('Превышен лимит запросов к сервису генерации. Попробуйте позже.', 429, true);
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenModelError('Ошибка авторизации сервиса генерации.', response.status, false);
    }

    if (!response.ok) {
      throw new OpenModelError(
        `Сервис генерации временно недоступен (${response.status}). Попробуйте позже.`,
        response.status,
        response.status >= 500,
      );
    }

    const result: ChatCompletionsResponse = await response.json();

    const textBlocks = result?.choices
      ?.map((choice) => choice.message.content)
      ?.filter((content): content is string => content !== null && content.trim().length > 0);

    if (!textBlocks || textBlocks.length === 0) {
      throw new OpenModelError('Не удалось сгенерировать сказку: пустой ответ от сервиса.', undefined, false);
    }

    return textBlocks.join('\n\n');
  } catch (error) {
    if (error instanceof OpenModelError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenModelError('Сервис генерации не ответил вовремя. Попробуйте ещё раз.', undefined, true);
    }
    throw new OpenModelError(
      'Не удалось создать сказку. Проверьте подключение к интернету и попробуйте позже.',
      undefined,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}
