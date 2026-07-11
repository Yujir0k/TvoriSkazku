import React, { useEffect, useState } from 'react';
import Generator from '../components/Generator';
import VoicePreviewButton from '../components/VoicePreviewButton.jsx';
import { getTtsVoices } from '../api.js';
import { DEFAULT_ELEVENLABS_VOICE, DEFAULT_ELEVENLABS_VOICE_ID, READY_NARRATOR_VOICES } from '../tts-config.js';
import { Sparkles, Plus, Check, HelpCircle, ArrowRight, Volume2, BookOpen, X } from 'lucide-react';

function playBenefitVideo(event) {
  const video = event.currentTarget.querySelector('.benefit-card-video');
  if (!video) return;

  video.dataset.hovered = 'true';
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function stopBenefitVideo(event) {
  const video = event.currentTarget.querySelector('.benefit-card-video');
  if (!video) return;

  video.dataset.hovered = 'false';
  video.pause();
  window.setTimeout(() => {
    if (video.dataset.hovered !== 'true') {
      video.currentTime = 0;
    }
  }, 120);
}

function BenefitCardVideo({ src, poster, label }) {
  return (
    <video
      className="benefit-card-video w-full h-full object-cover"
      src={src}
      poster={poster}
      muted
      playsInline
      loop
      preload="auto"
      disablePictureInPicture
      aria-label={label}
    />
  );
}

export default function Home({ navigate }) {
  // Состояние для FAQ
  const [openFaq, setOpenFaq] = useState(null); // null | index
  const [homeVoices, setHomeVoices] = useState(READY_NARRATOR_VOICES);
  const [homeVoiceId, setHomeVoiceId] = useState(DEFAULT_ELEVENLABS_VOICE_ID);

  useEffect(() => {
    let cancelled = false;
    getTtsVoices()
      .then((voices) => {
        if (cancelled) return;
        const available = voices.filter((voice) => voice.available);
        setHomeVoices(available.length > 0 ? available : READY_NARRATOR_VOICES);
      })
      .catch(() => {
        if (!cancelled) setHomeVoices(READY_NARRATOR_VOICES);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#faq') return;
    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById('faq');
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const homeVoice = homeVoices.find((voice) => voice.voiceId === homeVoiceId) || homeVoices[0] || DEFAULT_ELEVENLABS_VOICE;

  const faqData = [
    {
      q: 'Как работает генерация сказок?',
      a: 'Вы описываете идею сказки, выбираете жанр, возрастную группу и готовый голос рассказчика. ИИ создаёт добрую историю, а сервис озвучки превращает её в готовый MP3.'
    },
    {
      q: 'Какие голоса доступны?',
      a: 'Сказки можно озвучивать готовыми голосами рассказчиков. Вы выбираете характер голоса перед созданием или в редакторе сказки.'
    },
    {
      q: 'Сказки безопасны для детей?',
      a: 'Абсолютно. Мы используем специально настроенные языковые модели с жесткими фильтрами безопасности. Сказки учат дружбе, взаимопомощи, честности и не содержат пугающих или агрессивных сюжетов.'
    },
    {
      q: 'Можно ли скачать готовую сказку?',
      a: 'Вы можете скачать текст сказки, готовую озвучку в MP3 и PDF-книгу.'
    },
    {
      q: 'Какие варианты входа доступны в России?',
      a: 'Для пользователей из России доступны быстрый и безопасный вход через Яндекс ID и VK ID, а также стандартная авторизация по электронной почте.'
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="w-full">
      
      {/* 8.1 Hero-секция */}
      <section className="relative w-full overflow-hidden bg-transparent">
        <div className="relative min-[1100px]:max-w-[3000px] min-[1100px]:mx-auto">
          {/* Прозрачная акварельная сцена для desktop */}
          <div className="hidden min-[1100px]:block w-full pointer-events-none select-none">
            <img
              src="/assets/hero-scene-cutout-ultrawide.webp"
              alt=""
              className="block w-full h-auto min-[2100px]:w-[115%] min-[2100px]:max-w-none min-[2100px]:-ml-[7.5%] min-[2400px]:w-[122%] min-[2400px]:-ml-[11%]"
            />
          </div>

          {/* Текст привязан к центральному контейнеру, а не к ширине монитора */}
          <div className="w-full min-[1100px]:absolute min-[1100px]:inset-0 z-10 py-12 min-[1100px]:py-0">
            <div className="max-w-[1920px] min-[2200px]:max-w-[2240px] mx-auto w-full px-6 md:px-12 lg:px-16 min-[2100px]:px-20 min-[2400px]:px-24 h-full flex min-[1100px]:items-start">
              <div className="w-full min-[1100px]:w-[42%] min-[1100px]:max-w-[720px] min-[2100px]:max-w-[850px] min-[2400px]:max-w-[980px] min-[1100px]:ml-[26%] min-[2100px]:ml-[25%] min-[1100px]:mt-[8.5%] min-[2100px]:mt-[8%] text-center min-[1100px]:text-left mx-auto min-[1100px]:mx-0">
              <h1 className="font-title text-[clamp(2.2rem,7vw,2.9rem)] md:text-[clamp(3rem,5vw,4.1rem)] min-[1100px]:text-[clamp(3.25rem,3.35vw,4.25rem)] min-[2100px]:text-[clamp(4rem,3.45vw,4.85rem)] min-[2400px]:text-[clamp(4.7rem,3.35vw,5.45rem)] font-bold text-title leading-[1.03] tracking-tight max-w-[14ch] min-[1100px]:max-w-none mx-auto min-[1100px]:mx-0">
                <span className="block">Сказки, которые</span>
                <span className="block">знают имя вашего</span>
                <span className="block">ребенка и говорят</span>
                <span className="block">
                  <span className="inline-flex items-end gap-2 text-accent whitespace-nowrap">
                    <span>его сердцу</span>
                    <svg className="w-5 h-5 md:w-6 md:h-6 shrink-0 translate-y-[-0.05em]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </span>
                </span>
              </h1>
              <p className="hero-copy-description mt-5 md:mt-6 text-base sm:text-lg min-[1100px]:text-[clamp(1.05rem,1.05vw,1.35rem)] min-[2100px]:text-[1.42rem] min-[2400px]:text-[1.58rem] text-text leading-[1.35] font-medium max-w-[24rem] sm:max-w-[30rem] min-[1100px]:max-w-[28rem] min-[2100px]:max-w-[31rem] min-[2400px]:max-w-[34rem] mx-auto min-[1100px]:mx-0">
                Создаем добрые аудиосказки с помощью ИИ: истории, которые вдохновляют, развивают и остаются в памяти надолго.
              </p>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* 8.2 Блок "Начните сказку" */}
      <section className="page-shell-wide py-12 md:py-16 lg:py-20 min-[2100px]:py-24">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <h2 className="section-title-wide font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title">Начните сказку</h2>
          <p className="mt-4 text-sm md:text-base lg:text-lg text-text font-medium">
            Опишите идею, выберите настроение и дайте ИИ собрать теплую аудиоисторию для вашего ребенка.
          </p>
        </div>
        
        {/* Генератор */}
        <Generator navigate={navigate} />
      </section>

      {/* Разделитель */}
      <div className="page-shell-wide">
        <div className="w-full h-px bg-border-sep"></div>
      </div>

      {/* 8.3 Всё для детской сказки */}
      <section id="benefits" className="page-shell-wide py-16 md:py-20 lg:py-24 min-[2100px]:py-28 scroll-mt-28">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="section-title-wide font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title">Всё для детской сказки</h2>
          <p className="mt-4 text-sm md:text-base lg:text-lg text-text font-medium">
            Большие возможности без визуального шума: все, что нужно семье для спокойных вечеров, поездок и любимых историй.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          <div className="benefit-card bg-card border border-border-light rounded-card overflow-hidden p-0 grid grid-cols-1 sm:grid-cols-[44%_56%] items-stretch shadow-warm-soft hover:shadow-warm-md hover:-translate-y-1.5 transition-all duration-300 cursor-pointer min-h-[420px] sm:min-h-[360px] min-[2000px]:min-h-[430px] min-w-0" onMouseEnter={playBenefitVideo} onMouseLeave={stopBenefitVideo} onClick={() => navigate('/tvoriskazku-tales')}>
            <div className="w-full h-64 sm:h-full sm:min-h-[360px] min-[2000px]:min-h-[430px] overflow-hidden bg-warm-inner">
              <BenefitCardVideo src="/assets/benefit-hedgehog-hover.mp4" poster="/assets/benefit-hedgehog-hover-poster.jpg" label="Ёжик слушает сказку" />
            </div>
            <div className="flex flex-col justify-center items-center sm:items-start text-center sm:text-left w-full min-w-0 p-6 lg:p-7 min-[2000px]:p-10">
              <span className="px-3.5 py-1 bg-warm-peach text-accent rounded-full text-xs font-bold uppercase tracking-wider">5-12 минут</span>
              <h3 className="font-title text-2xl md:text-3xl lg:text-[2rem] 2xl:text-[2.15rem] min-[2000px]:text-[2.55rem] font-bold text-title mt-4 leading-tight max-w-full hyphens-auto">Аудиосказки и плейлисты</h3>
              <p className="text-sm md:text-base lg:text-lg min-[2000px]:text-xl text-text mt-3 leading-relaxed max-w-[32rem]">Слушайте готовые сказки или собирайте свои плейлисты для сна, дороги и спокойных игр.</p>
              <button className="mt-5 text-base font-bold text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors">
                Открыть библиотеку
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="benefit-card bg-card border border-border-light rounded-card overflow-hidden p-0 grid grid-cols-1 sm:grid-cols-[44%_56%] items-stretch shadow-warm-soft hover:shadow-warm-md hover:-translate-y-1.5 transition-all duration-300 cursor-pointer min-h-[420px] sm:min-h-[360px] min-[2000px]:min-h-[430px] min-w-0" onMouseEnter={playBenefitVideo} onMouseLeave={stopBenefitVideo} onClick={() => navigate('/story-creator')}>
            <div className="w-full h-64 sm:h-full sm:min-h-[360px] min-[2000px]:min-h-[430px] overflow-hidden bg-warm-inner">
              <BenefitCardVideo src="/assets/benefit-bear-hover.mp4" poster="/assets/benefit-bear-hover-poster.jpg" label="Медвежонок в сказочной озвучке" />
            </div>
            <div className="flex flex-col justify-center items-center sm:items-start text-center sm:text-left w-full min-w-0 p-6 lg:p-7 min-[2000px]:p-10">
              <span className="px-3.5 py-1 bg-warm-peach text-accent rounded-full text-xs font-bold uppercase tracking-wider">Студийный звук</span>
              <h3 className="font-title text-2xl md:text-3xl lg:text-[2rem] 2xl:text-[2.15rem] min-[2000px]:text-[2.55rem] font-bold text-title mt-4 leading-tight max-w-full hyphens-auto">Профессиональная озвучка</h3>
              <p className="text-sm md:text-base lg:text-lg min-[2000px]:text-xl text-text mt-3 leading-relaxed max-w-[32rem]">Выбирайте характер рассказчика, создавайте многоголосые сцены и скачивайте готовый MP3.</p>
              <button className="mt-5 text-base font-bold text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors">
                Создать и озвучить <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="benefit-card bg-card border border-border-light rounded-card overflow-hidden p-0 grid grid-cols-1 sm:grid-cols-[44%_56%] items-stretch shadow-warm-soft hover:shadow-warm-md hover:-translate-y-1.5 transition-all duration-300 cursor-pointer min-h-[420px] sm:min-h-[360px] min-[2000px]:min-h-[430px] min-w-0" onMouseEnter={playBenefitVideo} onMouseLeave={stopBenefitVideo} onClick={() => navigate('/story-characters')}>
            <div className="w-full h-64 sm:h-full sm:min-h-[360px] min-[2000px]:min-h-[430px] overflow-hidden bg-warm-inner">
              <BenefitCardVideo src="/assets/benefit-fox-hover.mp4" poster="/assets/benefit-fox-hover-poster.jpg" label="Лисёнок для любимых персонажей" />
            </div>
            <div className="flex flex-col justify-center items-center sm:items-start text-center sm:text-left w-full min-w-0 p-6 lg:p-7 min-[2000px]:p-10">
              <span className="px-3.5 py-1 bg-warm-peach text-accent rounded-full text-xs font-bold uppercase tracking-wider">До 6 героев</span>
              <h3 className="font-title text-2xl md:text-3xl lg:text-[2rem] 2xl:text-[2.15rem] min-[2000px]:text-[2.55rem] font-bold text-title mt-4 leading-tight max-w-full hyphens-auto">Любимые персонажи</h3>
              <p className="text-sm md:text-base lg:text-lg min-[2000px]:text-xl text-text mt-3 leading-relaxed max-w-[32rem]">Создайте профиль ребенка, его друзей или питомцев, чтобы они стали главными героями историй.</p>
              <button className="mt-5 text-base font-bold text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors">
                Создать героя
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="benefit-card bg-card border border-border-light rounded-card overflow-hidden p-0 grid grid-cols-1 sm:grid-cols-[44%_56%] items-stretch shadow-warm-soft hover:shadow-warm-md hover:-translate-y-1.5 transition-all duration-300 cursor-pointer min-h-[420px] sm:min-h-[360px] min-[2000px]:min-h-[430px] min-w-0" onMouseEnter={playBenefitVideo} onMouseLeave={stopBenefitVideo} onClick={() => navigate('/book-creation-printing')}>
            <div className="w-full h-64 sm:h-full sm:min-h-[360px] min-[2000px]:min-h-[430px] overflow-hidden bg-warm-inner">
              <BenefitCardVideo src="/assets/benefit-owl-hover.mp4" poster="/assets/benefit-owl-hover-poster.jpg" label="Сова с PDF-книгой" />
            </div>
            <div className="flex flex-col justify-center items-center sm:items-start text-center sm:text-left w-full min-w-0 p-6 lg:p-7 min-[2000px]:p-10">
              <span className="px-3.5 py-1 bg-warm-peach text-accent rounded-full text-xs font-bold uppercase tracking-wider">PDF-книги</span>
              <h3 className="font-title text-2xl md:text-3xl lg:text-[2rem] 2xl:text-[2.15rem] min-[2000px]:text-[2.55rem] font-bold text-title mt-4 leading-tight max-w-full hyphens-auto">PDF-книги</h3>
              <p className="text-sm md:text-base lg:text-lg min-[2000px]:text-xl text-text mt-3 leading-relaxed max-w-[32rem]">Скачайте PDF-макет и распечатайте сами. Печать и доставка будут доступны позже.</p>              <button className="mt-5 text-base font-bold text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors">
                Собрать книгу
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Разделитель */}
      <div className="page-shell-wide">
        <div className="w-full h-px bg-border-sep"></div>
      </div>

      {/* 8.4 Профессиональная озвучка */}
      <section className="page-shell-wide py-16 md:py-20 lg:py-24 min-[2100px]:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Левая колонка */}
          <div className="lg:col-span-5 flex flex-col">
            <span className="text-xs md:text-sm font-bold text-accent uppercase tracking-wider">Озвучка</span>
            <h2 className="section-title-wide font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title mt-2 leading-tight">
              Голоса для ваших сказок
            </h2>
            <p className="text-sm md:text-base text-text mt-4 leading-relaxed">
              Послушайте тембры заранее. После генерации сказка автоматически сохранится, и панель озвучки откроется прямо под текстом.
            </p>

            <div className="flex flex-col gap-3 mt-8">
              {homeVoices.map((voice) => (
                <div
                  key={voice.voiceId}
                  className={`w-full min-w-0 p-3 rounded-xl border bg-white flex items-center gap-3 transition-colors ${homeVoice.voiceId === voice.voiceId ? 'border-accent shadow-sm' : 'border-border-light hover:border-accent/50'}`}
                >
                  <button type="button" onClick={() => setHomeVoiceId(voice.voiceId)} className="flex-1 min-w-0 text-left">
                    <span className="block text-sm md:text-base font-bold text-title truncate">{voice.name}</span>
                    <span className="block text-xs text-text-secondary truncate">{voice.description}</span>
                  </button>
                  <VoicePreviewButton voice={voice} compact />
                  {homeVoice.voiceId === voice.voiceId ? (
                    <div className="w-5 h-5 rounded-full border border-accent bg-accent text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Правая колонка: Инфо-панель */}
          <div className="lg:col-span-7 bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-md">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Студийная озвучка</span>
            <h3 className="font-title text-2xl md:text-3xl font-bold text-title mt-1 break-words">{homeVoice.name}</h3>
            <p className="text-xs md:text-sm text-text-secondary mt-2 leading-relaxed min-h-[40px]">
              {homeVoice.description}. Нажмите кнопку, чтобы услышать демо-фрагмент до создания сказки.
            </p>

            <div className="mt-6 bg-warm-inner rounded-inner p-4 md:p-6 flex items-center gap-4 md:gap-6 min-w-0">
              <VoicePreviewButton
                voice={homeVoice}
                compact
                className="!w-12 !h-12 md:!w-14 md:!h-14 !bg-accent !text-white !border-accent hover:!bg-accent-hover shadow-md shrink-0"
              />

              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="h-8 flex items-end gap-[3px] overflow-hidden">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const heights = [20, 40, 60, 30, 50, 80, 45, 70, 35, 55, 90, 40, 65, 25, 50, 75, 30, 60, 85, 40, 55, 70, 35, 65, 80, 45, 60, 30, 50, 75, 40, 20];
                    const h = heights[i % heights.length];
                    return (
                      <div
                        key={i}
                        style={{ height: `${Math.max(12, h * 0.65)}%` }}
                        className="w-[4px] rounded-full bg-accent/70"
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-text-secondary font-semibold">
                  <span className="truncate">{homeVoice.name} · студийный голос</span>
                  <span>MP3</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-border-soft">
              <div className="text-center">
                <div className="text-sm md:text-base font-bold text-title">Студийный звук</div>
                <div className="text-[10px] md:text-xs text-text-secondary mt-0.5">выразительная речь</div>
              </div>
              <div className="text-center border-x border-border-soft">
                <div className="text-sm md:text-base font-bold text-title">До 10 голосов</div>
                <div className="text-[10px] md:text-xs text-text-secondary mt-0.5">в диалоге</div>
              </div>
              <div className="text-center">
                <div className="text-sm md:text-base font-bold text-title">Скачивание</div>
                <div className="text-[10px] md:text-xs text-text-secondary mt-0.5">готовый MP3</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/story-creator')}
              className="mt-6 w-full sm:w-auto px-6 py-3 rounded-full bg-accent text-white font-bold text-sm hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-2"
            >
              Создать сказку и озвучить
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>      {/* Разделитель */}
      <div className="page-shell-wide">
        <div className="w-full h-px bg-border-sep"></div>
      </div>

      {/* 8.5 Как это работает */}
      <section className="page-shell-wide py-16 md:py-20 lg:py-24 min-[2100px]:py-28">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="section-title-wide font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title">Как это работает</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 lg:gap-12">
          
          {/* Шаг 1 */}
          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-full bg-white border border-border-light flex items-center justify-center shadow-warm-soft">
              <span className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow-sm">1</span>
              <BookOpen className="w-10 h-10 text-accent" />
            </div>
            <h3 className="font-title text-2xl font-bold text-title mt-6">Опишите идею</h3>
            <p className="text-sm text-text mt-2 leading-relaxed max-w-[280px]">
              Введите имя ребенка, выберите жанр и в двух словах расскажите, о чем должна быть сказка.
            </p>
          </div>

          {/* Шаг 2 */}
          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-full bg-white border border-border-light flex items-center justify-center shadow-warm-soft">
              <span className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow-sm">2</span>
              <Sparkles className="w-10 h-10 text-accent" />
            </div>
            <h3 className="font-title text-2xl font-bold text-title mt-6">ИИ собирает сюжет</h3>
            <p className="text-sm text-text mt-2 leading-relaxed max-w-[280px]">
              ИИ создаёт уникальный текст по вашей идее.
            </p>
          </div>

          {/* Шаг 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-full bg-white border border-border-light flex items-center justify-center shadow-warm-soft">
              <span className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow-sm">3</span>
              <Volume2 className="w-10 h-10 text-accent" />
            </div>
            <h3 className="font-title text-2xl font-bold text-title mt-6">Слушайте вместе</h3>
            <p className="text-sm text-text mt-2 leading-relaxed max-w-[280px]">
              Включайте сказку на ночь, в дороге или собирайте собственную семейную аудиобиблиотеку.
            </p>
          </div>

        </div>
      </section>

      {/* Разделитель */}
      <div className="page-shell-wide">
        <div className="w-full h-px bg-border-sep"></div>
      </div>

      {/* 8.6 Тарифы для семьи */}
      <section className="page-shell-wide py-16 md:py-20 lg:py-24 min-[2100px]:py-28">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="section-title-wide font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title">Тарифы для семьи</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch w-full mx-auto">
          {[
            {
              id: 'free',
              name: 'Первые сказки',
              desc: 'бесплатно',
              price: '0 ₽',
              items: [
                '1 сказка бесплатно',
                'Все голоса рассказчиков',
                'Скачивание MP3',
              ],
              isUpcoming: false,
            },
            {
              id: 'family',
              name: 'Семейный',
              desc: 'планируется',
              price: '399 ₽',
              badge: 'Скоро',
              items: [
                '15 сказок в месяц',
                '5 готовых озвучек',
                'До 3 детских профилей',
                'Семейные плейлисты',
              ],
              isUpcoming: true,
              isPopular: true,
            },
            {
              id: 'premium',
              name: 'Премиум',
              desc: 'скоро',
              price: '799 ₽',
              items: [
                'Безлимитные сказки',
                'Многоголосая озвучка',
                'До 6 детских профилей',
                'Приоритетная генерация',
              ],
              isUpcoming: true,
            },
          ].map((plan) => (
            <div
              key={plan.id}
              className={`relative overflow-hidden border rounded-card p-8 md:p-9 lg:p-10 min-h-[520px] flex flex-col justify-between shadow-warm-soft transition-all duration-300 ease-out ${
                plan.isPopular
                  ? 'bg-warm-inner border-2 border-accent md:-translate-y-3 hover:-translate-y-5 hover:shadow-warm-lg'
                  : 'bg-white border-border-light hover:-translate-y-2 hover:shadow-warm-lg hover:border-accent/40'
              }`}
            >
              {plan.badge && (
                <span className="absolute top-4 right-4 px-3 py-1 bg-accent/80 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">{plan.badge}</span>
              )}
              <div>
                <h3 className="font-title text-3xl md:text-4xl font-bold text-title leading-tight pr-20 md:pr-0">{plan.name}</h3>
                <p className="text-sm text-text-secondary mt-1">{plan.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl md:text-6xl font-bold text-title tracking-tight">{plan.price}</span>
                  {plan.isUpcoming && <span className="text-xs text-text-secondary ml-1">в месяц</span>}
                </div>
                <ul className="mt-6 flex flex-col gap-3.5 text-base md:text-lg text-text">
                  {plan.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <Check className="w-5 h-5 text-accent shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {plan.id === 'free' ? (
                <button onClick={() => navigate('/')} className="w-full mt-8 py-4 rounded-full border border-border-light hover:border-accent hover:text-accent hover:bg-white font-bold text-base transition-colors">
                  Создать сказку
                </button>
              ) : (
                <button disabled className="w-full mt-8 py-4 rounded-full bg-white/70 border border-border-light text-text-secondary font-bold text-base cursor-not-allowed">
                  Оформить подписку
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* Разделитель */}
      <div className="page-shell-wide">
        <div className="w-full h-px bg-border-sep"></div>
      </div>

      {/* 8.7 FAQ */}
      <section id="faq" className="page-shell-wide py-16 md:py-20 lg:py-24 min-[2100px]:py-28 scroll-mt-32 md:scroll-mt-36 min-[2100px]:scroll-mt-40">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="section-title-wide font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title">Частые вопросы</h2>
        </div>

        <div className="max-w-[1140px] mx-auto border-t border-border-light">
          {faqData.map((item, idx) => (
            <div key={idx} className="border-b border-border-light">
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full py-6 flex items-center justify-between text-left hover:text-accent transition-colors duration-150 group"
              >
                <span className="font-bold text-title text-lg md:text-xl lg:text-2xl group-hover:text-accent transition-colors">{item.q}</span>
                <div className={`w-6 h-6 flex items-center justify-center text-accent transition-transform duration-300 ${openFaq === idx ? 'rotate-45' : ''}`}>
                  <Plus className="w-5 h-5" />
                </div>
              </button>
              {openFaq === idx && (
                <div className="pb-6 transition-all duration-300 animate-fadeIn">
                  <p className="text-base md:text-lg text-text leading-relaxed">
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
