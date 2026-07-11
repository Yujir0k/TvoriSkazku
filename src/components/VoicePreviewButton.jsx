import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Pause, Play } from 'lucide-react';

const PREVIEW_EVENT = 'tvoriskazku:voice-preview-start';

export default function VoicePreviewButton({ voice, compact = false, className = '' }) {
  const audioRef = useRef(null);
  const previewInstanceId = useId();
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    const stopOtherPreview = (event) => {
      if (event.detail !== previewInstanceId && audioRef.current) {
        audioRef.current.pause();
      }
    };
    window.addEventListener(PREVIEW_EVENT, stopOtherPreview);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, stopOtherPreview);
      audioRef.current?.pause();
    };
  }, [previewInstanceId]);

  const togglePreview = async (event) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !voice.previewUrl) return;
    setPreviewError('');
    if (!audio.paused) {
      audio.pause();
      return;
    }
    window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: previewInstanceId }));
    try {
      if (audio.readyState === 0) audio.load();
      if (audio.readyState > 0) audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      // Автоматизированные/встроенные браузеры могут блокировать media.play()
      // без настоящего пользовательского жеста. Для обычного клика это не ошибка файла.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        setPreviewError(error instanceof Error ? `${error.name}: ${error.message}` : 'Не удалось воспроизвести демо');
      }
      setIsPlaying(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <audio
        ref={audioRef}
        src={voice.previewUrl || undefined}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setPreviewError('Браузер не смог загрузить аудиофайл')}
      />
      <button
        type="button"
        onClick={togglePreview}
        disabled={!voice.previewUrl}
        aria-label={`${isPlaying ? 'Остановить' : 'Послушать'} голос ${voice.name}`}
        title={voice.previewUrl ? `Демо голоса ${voice.name}` : 'Демо пока недоступно'}
        className={`${compact ? 'w-8 h-8' : 'px-3 py-2'} rounded-full border border-accent/30 bg-white text-accent hover:bg-accent hover:text-white disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 transition-colors ${className}`}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {compact ? null : <span className="text-xs font-bold">{isPlaying ? 'Пауза' : 'Демо'}</span>}
      </button>
      {previewError ? (
        <span title={previewError} data-preview-error={previewError}>
          <AlertCircle className="w-3.5 h-3.5 text-red-500" aria-label="Ошибка загрузки демо" />
        </span>
      ) : null}
    </span>
  );
}
