import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';

/**
 * Переиспользуемый аудиоплеер для будущих файлов из MinIO.
 * Пока работает как заглушка — показывает контролы, но не воспроизводит реальный файл.
 */
export default function AudioPlayer({ src, mimeType, onEnded, autoPlay = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setLoading(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
    if (onEnded) onEnded();
  }, [onEnded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', () => {
      setError('Ошибка загрузки аудио');
      setLoading(false);
    });

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded]);

  useEffect(() => {
    if (autoPlay && src) {
      handlePlay();
    }
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlay = async () => {
    if (!audioRef.current || !src) return;
    setLoading(true);
    setError('');
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch (err) {
      setError(err.message || 'Не удалось воспроизвести');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolumeState(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    setMuted(val === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
    setCurrentTime(val);
  };

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Empty state
  if (!src) {
    return (
      <div className="flex items-center gap-3 p-3 bg-warm-inner/50 rounded-xl border border-border-light/60">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-text-secondary/40">
          <Play className="w-4 h-4" />
        </div>
        <span className="text-xs text-text-secondary">Аудиофайл будет доступен после генерации</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-warm-inner/50 rounded-xl border border-border-light/60">
      <audio ref={audioRef} src={src} type={mimeType} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={playing ? handlePause : handlePlay}
        disabled={loading || !!error}
        className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-all"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current translate-x-0.5" />
        )}
      </button>

      {/* Timeline */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 accent-accent cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-text-secondary font-semibold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1">
        <button onClick={toggleMute} className="text-text-secondary hover:text-accent transition-colors">
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-16 h-1 accent-accent cursor-pointer"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
