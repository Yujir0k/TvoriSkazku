import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, X } from 'lucide-react';

const INTRO_VIDEO_SRC = '/assets/intro-rabbit-magic.mp4?v=clean-20260705';
const INTRO_POSTER_SRC = '/assets/intro-rabbit-magic-poster.jpg?v=clean-20260705';
const FADE_OUT_MS = 720;
let introShownThisRuntime = false;

function shouldShowIntro() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return !introShownThisRuntime;
}

export default function SplashIntro() {
  const videoRef = useRef(null);
  const fadeFrameRef = useRef(null);
  const [visible, setVisible] = useState(shouldShowIntro);
  const [closing, setClosing] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  const finishIntro = useCallback(() => {
    const video = videoRef.current;

    if (fadeFrameRef.current) {
      window.cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }

    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    introShownThisRuntime = true;
    setVisible(false);
  }, []);

  const closeIntro = useCallback(() => {
    if (closing) return;

    const video = videoRef.current;
    setClosing(true);

    if (!video || video.paused || video.volume <= 0.02) {
      window.setTimeout(finishIntro, FADE_OUT_MS);
      return;
    }

    const startVolume = video.volume || 0.9;
    const startedAt = performance.now();

    const fadeAudio = (now) => {
      const progress = Math.min((now - startedAt) / FADE_OUT_MS, 1);

      if (videoRef.current) {
        videoRef.current.volume = Math.max(0, startVolume * (1 - progress));
      }

      if (progress < 1) {
        fadeFrameRef.current = window.requestAnimationFrame(fadeAudio);
      } else {
        finishIntro();
      }
    };

    fadeFrameRef.current = window.requestAnimationFrame(fadeAudio);
  }, [closing, finishIntro]);

  useEffect(() => {
    if (!visible) return undefined;

    return () => {
      if (fadeFrameRef.current) {
        window.cancelAnimationFrame(fadeFrameRef.current);
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const video = videoRef.current;
    if (!video) return;

    video.volume = 0.92;
    video.muted = false;

    const playPromise = video.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setNeedsGesture(true);
      });
    }
  }, [visible]);

  const startWithSound = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.currentTime = 0;
      video.volume = 0.92;
      video.muted = false;
      await video.play();
      setNeedsGesture(false);
    } catch {
      setNeedsGesture(true);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`splash-intro ${closing ? 'is-closing' : ''}`}
      role="dialog"
      aria-label="Волшебная заставка ТвориСказку"
      aria-modal="true"
      onClick={needsGesture ? startWithSound : undefined}
    >
      <video
        className="splash-intro__video splash-intro__video--backdrop"
        src={INTRO_VIDEO_SRC}
        poster={INTRO_POSTER_SRC}
        aria-hidden="true"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />

      <div className="splash-intro__glow" aria-hidden="true" />

      <video
        ref={videoRef}
        className="splash-intro__video splash-intro__video--main"
        src={INTRO_VIDEO_SRC}
        poster={INTRO_POSTER_SRC}
        autoPlay
        playsInline
        preload="auto"
        onEnded={closeIntro}
        onError={closeIntro}
      />

      {needsGesture && !closing && (
        <div className="splash-intro__start-card">
          <div className="splash-intro__start-icon">
            <Volume2 size={24} />
          </div>
          <p>Начните сказку со звуком</p>
          <button type="button" onClick={startWithSound}>
            Смотреть заставку
          </button>
        </div>
      )}

      <button
        type="button"
        className="splash-intro__skip"
        onClick={(event) => {
          event.stopPropagation();
          closeIntro();
        }}
        aria-label="Пропустить заставку"
      >
        <span>Пропустить</span>
        <X size={16} />
      </button>
    </div>
  );
}
