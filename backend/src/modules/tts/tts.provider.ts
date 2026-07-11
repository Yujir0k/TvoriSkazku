// ─── TTS Provider Interface ────────────────────────────────────────────────
// Будущий провайдер озвучки (ElevenLabs и др.)

/**
 * Единый интерфейс для любого TTS-провайдера.
 */
export interface TtsVoice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  previewUrl?: string;
}

export interface TtsJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  audioUrl?: string;
  durationMs?: number;
  error?: string;
}

export interface TtsProvider {
  /** Получить список доступных голосов */
  listVoices(): Promise<TtsVoice[]>;

  /** Создать задачу на озвучку */
  createJob(params: {
    text: string;
    voiceId: string;
    speed?: number;
  }): Promise<TtsJob>;

  /** Получить статус задачи */
  getJobStatus(jobId: string): Promise<TtsJob | null>;

  /** Отменить задачу */
  cancelJob(jobId: string): Promise<boolean>;

  /** Получить результат (URL или путь к файлу) */
  getResult(jobId: string): Promise<{ url: string; durationMs: number } | null>;
}

// ─── Константы ошибок ────────────────────────────────────────────────────────

export const TTS_NOT_CONFIGURED = 'TTS_NOT_CONFIGURED';
export const TTS_DISABLED_MESSAGE = 'Озвучка будет доступна после подключения сервиса';

// ─── Заглушка (возвращается, если нет провайдера) ────────────────────────────

export function createStubTtsProvider(): TtsProvider {
  return {
    async listVoices() {
      throw Object.assign(new Error(TTS_DISABLED_MESSAGE), { code: TTS_NOT_CONFIGURED });
    },
    async createJob() {
      throw Object.assign(new Error(TTS_DISABLED_MESSAGE), { code: TTS_NOT_CONFIGURED });
    },
    async getJobStatus() {
      throw Object.assign(new Error(TTS_DISABLED_MESSAGE), { code: TTS_NOT_CONFIGURED });
    },
    async cancelJob() {
      throw Object.assign(new Error(TTS_DISABLED_MESSAGE), { code: TTS_NOT_CONFIGURED });
    },
    async getResult() {
      throw Object.assign(new Error(TTS_DISABLED_MESSAGE), { code: TTS_NOT_CONFIGURED });
    },
  };
}
