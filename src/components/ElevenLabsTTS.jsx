import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Loader2, AlertCircle, Play, Pause, Download, Trash2, Mic, XCircle, Check } from 'lucide-react';
import {
  getTtsVoices,
  generateStoryAudio,
  getStoryAudioList,
  getStoryAudioStatus,
  getStoryAudioUrl,
  getStoryAudioDownloadUrl,
  deleteStoryAudio,
  cancelStoryAudio,
} from '../api.js';
import { DEFAULT_ELEVENLABS_VOICE, DEFAULT_ELEVENLABS_VOICE_ID, READY_NARRATOR_VOICES } from '../tts-config.js';
import VoicePreviewButton from './VoicePreviewButton.jsx';

export default function ElevenLabsTTS({
  storyId,
  characterVoices,
  onDelete,
  defaultVoiceId = DEFAULT_ELEVENLABS_VOICE_ID,
  selectedVoiceId,
  voices: providedVoices,
  onVoiceChange,
  onRequestVoiceChange,
  downloadName = 'skazka',
}) {
  const [ttsVoices, setTtsVoices] = useState(() => (
    providedVoices?.length ? providedVoices : READY_NARRATOR_VOICES
  ));
  const [ttsVoiceId, setTtsVoiceId] = useState(selectedVoiceId || defaultVoiceId);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [ttsMode, setTtsMode] = useState('single');
  const [ttsExpressive] = useState(true);
  const [ttsStatus, setTtsStatus] = useState('idle');
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsAudioUrl, setTtsAudioUrl] = useState('');
  const [ttsAudioId, setTtsAudioId] = useState('');
  const [ttsError, setTtsError] = useState('');
  const [ttsDurationMs, setTtsDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const audioRef = useRef(null);
  const ttsPollRef = useRef(null);

  const loadTtsVoices = useCallback(async () => {
    try {
      const voices = await getTtsVoices();
      const available = voices.filter(v => v.available);
      const nextVoices = available.length > 0 ? available : READY_NARRATOR_VOICES;
      setTtsVoices(nextVoices);
      setTtsVoiceId((currentVoiceId) => (
        nextVoices.some((voice) => voice.voiceId === (selectedVoiceId || defaultVoiceId))
          ? (selectedVoiceId || defaultVoiceId)
          : (nextVoices.some((voice) => voice.voiceId === currentVoiceId)
              ? currentVoiceId
              : nextVoices[0].voiceId)
      ));
    } catch (err) {
      setTtsVoices(READY_NARRATOR_VOICES);
      setTtsVoiceId((currentVoiceId) => (
        READY_NARRATOR_VOICES.some((voice) => voice.voiceId === currentVoiceId)
          ? currentVoiceId
          : READY_NARRATOR_VOICES[0].voiceId
      ));
    }
  }, [defaultVoiceId, selectedVoiceId]);

  useEffect(() => {
    if (providedVoices?.length) {
      setTtsVoices(providedVoices);
      return;
    }
    void loadTtsVoices();
  }, [loadTtsVoices, providedVoices]);

  useEffect(() => {
    if (selectedVoiceId) setTtsVoiceId(selectedVoiceId);
  }, [selectedVoiceId]);

  const clearPolling = useCallback(() => {
    if (ttsPollRef.current) {
      clearInterval(ttsPollRef.current);
      ttsPollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  // Restore existing audio on mount
  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    getStoryAudioList(storyId)
      .then((list) => {
        if (cancelled || !list.length) return;
        const active = list.find((a) => a.status === 'queued' || a.status === 'processing');
        if (active) {
          if (!selectedVoiceId && active.voiceId) setTtsVoiceId(active.voiceId);
          setTtsAudioId(active.id);
          setTtsStatus('processing');
          setTtsProgress(Math.max(1, active.progress || 0));
          startTtsPolling(active.id);
          return;
        }
        const completed = list.find((a) => a.status === 'completed');
        if (completed) {
          if (!selectedVoiceId && completed.voiceId) setTtsVoiceId(completed.voiceId);
          setTtsAudioId(completed.id);
          setTtsStatus('completed');
          getStoryAudioUrl(completed.id).then((urlData) => {
            if (!cancelled) {
              setTtsAudioUrl(urlData.url);
              setTtsDurationMs(urlData.durationMs || 0);
            }
          }).catch(() => {
            if (!cancelled) setTtsError('Плеер временно недоступен, но готовый MP3 можно скачать.');
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setTtsError('Не удалось загрузить список озвучек: ' + (err.message || ''));
      });
    return () => { cancelled = true; };
  }, [selectedVoiceId, storyId]);

  const startTtsPolling = useCallback((audioId) => {
    let consecutiveErrors = 0;
    clearPolling();
    ttsPollRef.current = setInterval(async () => {
      try {
        const status = await getStoryAudioStatus(audioId);
        consecutiveErrors = 0;
        setTtsProgress(Math.max(1, status.progress || 0));
        if (status.status === 'completed') {
          setTtsStatus('completed');
          clearPolling();
          const urlData = await getStoryAudioUrl(audioId);
          setTtsAudioUrl(urlData.url);
          setTtsDurationMs(urlData.durationMs || 0);
        } else if (status.status === 'failed') {
          setTtsStatus('failed');
          setTtsError(status.error || 'Ошибка озвучки');
          clearPolling();
        } else if (status.status === 'cancelled') {
          setTtsStatus('idle');
          clearPolling();
        } else {
          setTtsStatus('processing');
        }
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          setTtsError(err?.message || 'Не удалось проверить статус озвучки');
        }
      }
    }, 2000);
  }, [clearPolling]);

  const handleGenerateAudio = async () => {
    if (!storyId) return;
    setTtsStatus('loading');
    setTtsError('');
    setDownloadSuccess(false);
    setTtsAudioUrl('');
    setTtsAudioId('');
    try {
      const result = await generateStoryAudio(storyId, {
        voiceId: selectedVoiceId || ttsVoiceId,
        mode: ttsMode,
        expressive: ttsExpressive,
        characterVoices,
      });
      setTtsAudioId(result.id);
      setTtsStatus('processing');
      startTtsPolling(result.id);
    } catch (err) {
      setTtsStatus('failed');
      setTtsError(err.message || 'Не удалось запустить озвучку');
    }
  };

  const handleCancelAudio = async () => {
    if (!ttsAudioId) return;
    try {
      await cancelStoryAudio(ttsAudioId);
      setTtsStatus('idle');
      setTtsProgress(0);
      clearPolling();
    } catch (err) {
      setTtsError(err.message || 'Ошибка отмены');
    }
  };

  const handleDeleteAudio = async () => {
    if (!ttsAudioId) return;
    try {
      await deleteStoryAudio(ttsAudioId);
      clearPolling();
      setTtsStatus('idle');
      setTtsAudioUrl('');
      setTtsAudioId('');
      setTtsDurationMs(0);
      setTtsProgress(0);
      if (onDelete) onDelete(ttsAudioId);
    } catch (err) {
      setTtsError(err.message || 'Ошибка удаления');
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleDownloadMp3 = async () => {
    if (!ttsAudioId || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    setTtsError('');
    try {
      const a = document.createElement('a');
      a.href = getStoryAudioDownloadUrl(ttsAudioId);
      const cleanName = String(downloadName || 'skazka')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || 'skazka';
      a.download = cleanName.toLowerCase().endsWith('.mp3') ? cleanName : `${cleanName}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadSuccess(true);
    } catch (err) {
      setTtsError(err.message || 'Ошибка скачивания');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVoiceSelect = (nextVoiceId) => {
    setTtsVoiceId(nextVoiceId);
    onVoiceChange?.(nextVoiceId);
    setIsVoicePickerOpen(false);
  };

  const hasCharacterVoices = characterVoices && Object.keys(characterVoices).length > 0;
  const effectiveVoiceId = selectedVoiceId || ttsVoiceId;
  const selectedTtsVoice = ttsVoices.find((voice) => voice.voiceId === effectiveVoiceId) || DEFAULT_ELEVENLABS_VOICE;

  return (
    <div className="flex flex-col gap-3 min-w-0" data-testid="story-audio-panel">
      <div className="rounded-xl border border-border-light bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <Mic className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Рассказчик</span>
          <span className="block text-sm font-bold text-title truncate">{selectedTtsVoice.name}</span>
          <span className="block text-xs text-text-secondary truncate">{selectedTtsVoice.description}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <VoicePreviewButton voice={selectedTtsVoice} />
          {(onRequestVoiceChange || onVoiceChange) && (ttsStatus === 'idle' || ttsStatus === 'failed') ? (
            <button
              type="button"
              onClick={() => {
                if (onRequestVoiceChange) onRequestVoiceChange();
                else setIsVoicePickerOpen((open) => !open);
              }}
              className="px-3 py-2 rounded-full text-xs font-bold border border-border-light text-text-secondary hover:border-accent hover:text-accent transition-colors"
            >
              Сменить голос
            </button>
          ) : null}
        </div>
      </div>

      {isVoicePickerOpen && onVoiceChange ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border-light bg-warm-inner/30 p-3">
          {ttsVoices.map((voice) => (
            <button
              type="button"
              key={voice.voiceId}
              onClick={() => handleVoiceSelect(voice.voiceId)}
              className={`rounded-xl border p-3 text-left transition-colors flex items-start gap-2 ${
                effectiveVoiceId === voice.voiceId
                  ? 'border-accent bg-accent/10'
                  : 'border-border-light bg-white hover:border-accent/50'
              }`}
              aria-label={`Выбрать голос ${voice.name}`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-title">{voice.name}</span>
                <span className="block text-xs text-text-secondary mt-0.5">{voice.description}</span>
              </span>
              {effectiveVoiceId === voice.voiceId ? <Check className="w-4 h-4 text-accent shrink-0" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {hasCharacterVoices ? (
        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={ttsMode === 'dialogue'}
            onChange={(e) => setTtsMode(e.target.checked ? 'dialogue' : 'single')}
            disabled={ttsStatus === 'loading' || ttsStatus === 'processing'}
            className="rounded"
          />
          Озвучить реплики персонажей разными голосами
        </label>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap" aria-live="polite">
        {(ttsStatus === 'idle' || ttsStatus === 'failed') && (
          <button onClick={handleGenerateAudio}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full text-sm font-bold bg-accent text-white hover:bg-accent-hover transition-all flex items-center justify-center gap-2">
            <Volume2 className="w-4 h-4" />
            {ttsStatus === 'failed' ? 'Попробовать озвучить снова' : 'Озвучить сказку'}
          </button>
        )}
        {ttsStatus === 'loading' && (
          <span className="text-xs text-text-secondary flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Запуск...
          </span>
        )}
        {ttsStatus === 'processing' && (
          <>
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span className="text-xs text-text-secondary">Идёт озвучка. Пожалуйста, подождите.</span>
            </div>
            <button onClick={handleCancelAudio}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-all">
              <XCircle className="w-3 h-3" />
              Отменить
            </button>
          </>
        )}
        {ttsStatus === 'completed' && (
          <>
            {ttsAudioUrl ? (
              <>
                <audio ref={audioRef} src={ttsAudioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                <button onClick={handlePlayPause}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all flex items-center gap-1">
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isPlaying ? 'Пауза' : 'Слушать'}
                </button>
              </>
            ) : null}
            <button onClick={handleDownloadMp3}
              disabled={isDownloading}
              data-testid="download-mp3"
              className="px-4 py-2 rounded-full text-xs font-bold bg-accent text-white hover:bg-accent-hover disabled:opacity-60 transition-all flex items-center gap-1.5">
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isDownloading ? 'Скачиваем...' : 'Скачать MP3'}
            </button>
            <button onClick={handleDeleteAudio}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary hover:text-red-500 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Удалить аудио
            </button>
            {ttsDurationMs > 0 && (
              <span className="text-xs text-text-secondary">{Math.round(ttsDurationMs / 1000)} сек</span>
            )}
          </>
        )}
      </div>

      {downloadSuccess ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" /> Скачивание MP3 началось
        </div>
      ) : null}

      {ttsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{ttsError}</span>
        </div>
      )}
    </div>
  );
}
