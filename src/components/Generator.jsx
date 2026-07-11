import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Plus, UserPlus, Loader2, AlertCircle, CheckCircle, RefreshCw, Minus, Plus as PlusIcon, Bookmark, Volume2, ExternalLink, X } from 'lucide-react';

import { generateStory, getStoryJob, cancelStoryJob, createStory, updateStory, getProfiles, getCharacters, getTtsVoices } from '../api.js';
import ElevenLabsTTS from './ElevenLabsTTS.jsx';
import StoryText from './StoryText.jsx';
import VoicePreviewButton from './VoicePreviewButton.jsx';
import StoryPdfButton from './StoryPdfButton.jsx';
import { useAuth } from '../AuthContext.jsx';
import { DEFAULT_ELEVENLABS_VOICE, DEFAULT_ELEVENLABS_VOICE_ID, READY_NARRATOR_VOICES } from '../tts-config.js';
import { createSurpriseStory } from '../lib/surprise-story.js';
import { hasPersonalData, hasUnsafeNameInput, PERSONAL_DATA_BLOCK_MESSAGE } from '../lib/personal-data-filter.js';

const GENERATOR_DRAFT_KEY = 'tvoriskazku.generatorDraft.v1';

function readGeneratorDraft() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(GENERATOR_DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function Generator({ navigate }) {
  const { user } = useAuth();

  const [isCustomGenreOpen, setIsCustomGenreOpen] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [isExtraOpen, setIsExtraOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('genre'); // 'genre' | 'age' | 'voice' | 'chapters' | 'characters' | 'location'

  // Состояние выбранных настроек
  const [genre, setGenre] = useState('Фэнтези');
  const [customGenre, setCustomGenre] = useState('');
  const [ageGroup, setAgeGroup] = useState('6-8');
  const [voiceId, setVoiceId] = useState(DEFAULT_ELEVENLABS_VOICE_ID);
  const [ttsVoices, setTtsVoices] = useState(READY_NARRATOR_VOICES);
  const [ttsVoicesLoading, setTtsVoicesLoading] = useState(true);
  const [ttsVoicesError, setTtsVoicesError] = useState('');
  const [chapters, setChapters] = useState(1);
  const [chaptersInput, setChaptersInput] = useState('1');
  const [chapterError, setChapterError] = useState('');
  const [character, setCharacter] = useState('Без героя');
  const [childName, setChildName] = useState('');
  const [location, setLocation] = useState('Лесная тропинка');

  // Personalization
  const [profiles, setProfiles] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [childProfileId, setChildProfileId] = useState('');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState([]);
  const [profilesError, setProfilesError] = useState('');
  const [charactersError, setCharactersError] = useState('');
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [charactersLoading, setCharactersLoading] = useState(true);

  // Фильтр: если выбран профиль — показываем только его персонажей + общих
  const displayedCharacters = childProfileId
    ? allCharacters.filter((c) => !c.childProfileId || c.childProfileId === childProfileId)
    : allCharacters;

  // Load profiles & characters for signed-in users only.
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setAllCharacters([]);
      setChildProfileId('');
      setSelectedCharacterIds([]);
      setProfilesError('');
      setCharactersError('');
      setProfilesLoading(false);
      setCharactersLoading(false);
      return;
    }

    let cancelled = false;
    setProfilesLoading(true);
    getProfiles()
      .then((data) => {
        if (!cancelled) {
          setProfiles(data);
          setProfilesError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setProfilesError(err.message || 'Не удалось загрузить профили');
      })
      .finally(() => {
        if (!cancelled) setProfilesLoading(false);
      });

    setCharactersLoading(true);
    getCharacters()
      .then((data) => {
        if (!cancelled) {
          setAllCharacters(data);
          setCharactersError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setCharactersError(err.message || 'Не удалось загрузить персонажей');
      })
      .finally(() => {
        if (!cancelled) setCharactersLoading(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    setTtsVoicesLoading(true);
    getTtsVoices()
      .then((voices) => {
        const availableVoices = voices.filter((voice) => voice.available);
        const nextVoices = availableVoices.length > 0 ? availableVoices : READY_NARRATOR_VOICES;
        setTtsVoices(nextVoices);
        setVoiceId((currentVoiceId) => (
          nextVoices.some((voice) => voice.voiceId === currentVoiceId)
            ? currentVoiceId
            : nextVoices[0].voiceId
        ));
        setTtsVoicesError('');
      })
      .catch(() => {
        setTtsVoices(READY_NARRATOR_VOICES);
        setVoiceId((currentVoiceId) => (
          READY_NARRATOR_VOICES.some((voice) => voice.voiceId === currentVoiceId)
            ? currentVoiceId
            : READY_NARRATOR_VOICES[0].voiceId
        ));
        setTtsVoicesError('');
      })
      .finally(() => setTtsVoicesLoading(false));
  }, []);

  const handleSelectProfile = (id) => {
    setChildProfileId(childProfileId === id ? '' : id);
    setSelectedCharacterIds([]);
  };

  const handleToggleCharacter = (id) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const [generationState, setGenerationState] = useState('idle');
  const [generationMessage, setGenerationMessage] = useState('');
  const [storyResult, setStoryResult] = useState('');
  const [storyError, setStoryError] = useState('');
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedStoryId, setSavedStoryId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saveBlocked, setSaveBlocked] = useState(false);
  const pollRef = useRef(null);
  const animFrameRef = useRef(null);
  const displayValueRef = useRef(0);
  const progressRef = useRef(0);
  const generationStartedAtRef = useRef(null);
  const savePromiseRef = useRef(null);
  const recentSurpriseIdeasRef = useRef(new Set());
  const draftHydratedRef = useRef(false);

  useEffect(() => {
    const draft = readGeneratorDraft();
    if (typeof draft.ideaText === 'string') setIdeaText(draft.ideaText.slice(0, 700));
    if (typeof draft.isExtraOpen === 'boolean') setIsExtraOpen(draft.isExtraOpen);
    if (typeof draft.activeSection === 'string' || draft.activeSection === null) setActiveSection(draft.activeSection);
    if (typeof draft.genre === 'string') setGenre(draft.genre);
    if (typeof draft.customGenre === 'string') setCustomGenre(draft.customGenre);
    if (typeof draft.ageGroup === 'string') setAgeGroup(draft.ageGroup);
    if (typeof draft.voiceId === 'string') setVoiceId(draft.voiceId);
    if (Number.isInteger(draft.chapters)) {
      const nextChapters = Math.min(10, Math.max(1, draft.chapters));
      setChapters(nextChapters);
      setChaptersInput(String(nextChapters));
    } else if (typeof draft.chaptersInput === 'string') {
      setChaptersInput(draft.chaptersInput);
    }
    if (typeof draft.character === 'string') setCharacter(draft.character);
    if (typeof draft.childName === 'string') setChildName(draft.childName);
    if (typeof draft.location === 'string') setLocation(draft.location);
    if (typeof draft.childProfileId === 'string') setChildProfileId(draft.childProfileId);
    if (Array.isArray(draft.selectedCharacterIds)) {
      setSelectedCharacterIds(draft.selectedCharacterIds.filter((id) => typeof id === 'string'));
    }
    draftHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    try {
      window.sessionStorage.setItem(GENERATOR_DRAFT_KEY, JSON.stringify({
        ideaText,
        isExtraOpen,
        activeSection,
        genre,
        customGenre,
        ageGroup,
        voiceId,
        chapters,
        chaptersInput,
        character,
        childName,
        location,
        childProfileId,
        selectedCharacterIds,
      }));
    } catch {
      // The generator remains usable even if browser storage is unavailable.
    }
  }, [
    ideaText,
    isExtraOpen,
    activeSection,
    genre,
    customGenre,
    ageGroup,
    voiceId,
    chapters,
    chaptersInput,
    character,
    childName,
    location,
    childProfileId,
    selectedCharacterIds,
  ]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Держим ref с реальным прогрессом бэкенда для анимации
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Временная шкала прогресса и анимация (один requestAnimationFrame)
  useEffect(() => {
    // Останавливаем предыдущий кадр
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (generationState === 'idle' || generationState === 'error') {
      displayValueRef.current = 0;
      setDisplayProgress(0);
      return;
    }

    const loop = () => {
      const elapsed = generationStartedAtRef.current ? Date.now() - generationStartedAtRef.current : 0;

      if (generationState === 'completed') {
        // Плавно доводим до 100%
        const cur = displayValueRef.current;
        if (cur >= 100) {
          setDisplayProgress(100);
          animFrameRef.current = null;
          return;
        }
        const step = Math.max(0.5, (100 - cur) * 0.12);
        const next = Math.min(cur + step, 100);
        displayValueRef.current = next;
        setDisplayProgress(+next.toFixed(1));
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // generating / loading — staged progress по времени
      const backendReal = progressRef.current || 0;
      const floor = Math.min(backendReal, 92);

      let timeBased;
      if (elapsed < 2000) {
        // 0→12% за первые 2 секунды
        timeBased = (elapsed / 2000) * 12;
      } else if (elapsed < 8000) {
        // 12→35% с 2с до 8с
        timeBased = 12 + ((elapsed - 2000) / 6000) * 23;
      } else if (elapsed < 20000) {
        // 35→60% с 8с до 20с
        timeBased = 35 + ((elapsed - 8000) / 12000) * 25;
      } else if (elapsed < 35000) {
        // 60→82% с 20с до 35с
        timeBased = 60 + ((elapsed - 20000) / 15000) * 22;
      } else {
        // после 35с — очень медленно от 82 до 90 (асимптота)
        const extra = (elapsed - 35000) / 60000;
        timeBased = Math.min(82 + extra * 8, 90);
      }

      const target = Math.min(Math.max(timeBased, floor), 92);
      const cur = displayValueRef.current;

      let next;
      if (target > cur) {
        // Плавно догоняем цель
        const step = Math.max(0.3, (target - cur) * 0.08);
        next = Math.min(cur + step, target);
      } else {
        // Не откатываемся (микродыхание для живости)
        const breathe = Math.sin(elapsed / 4000) * 0.15;
        next = Math.max(cur, cur + breathe * 0.03);
      }

      displayValueRef.current = next;
      setDisplayProgress(+next.toFixed(1));
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [generationState]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (!jobId || generationState === 'completed' || generationState === 'error' || generationState === 'idle') {
      stopPolling();
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const data = await getStoryJob(jobId);
        setProgress(data.progress || 0);

        if (data.status === 'completed') {
          setGenerationState('completed');
          setStoryResult(data.result || '');
          setGenerationMessage('Сказка готова!');
          stopPolling();
        } else if (data.status === 'failed') {
          setGenerationState('error');
          setStoryError(data.error || 'Ошибка генерации');
          setGenerationMessage(data.error || 'Ошибка генерации');
          stopPolling();
        } else if (data.status === 'cancelled') {
          // Job was cancelled on backend — reset UI
          stopPolling();
          setGenerationState('idle');
          setGenerationMessage('');
          setStoryResult('');
          setStoryError('');
          setJobId(null);
          setProgress(0);
        } else if (data.status === 'generating') {
          setGenerationState('generating');
          setGenerationMessage(data.message || 'ИИ сочиняет сказку...');
        } else {
          setGenerationMessage(data.message || 'Задача в очереди...');
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => stopPolling();
  }, [jobId, generationState, stopPolling]);

  const handleGenerate = async () => {
    if (!user) {
      navigate('/sign-in');
      return;
    }

    // Валидация глав
    const raw = chaptersInput.trim();
    const num = parseInt(raw, 10);
    if (raw === '' || isNaN(num) || num < chapterMin || num > chapterMax) {
      setChapterError('Укажите число от ' + chapterMin + ' до ' + chapterMax);
      setGenerationState('error');
      setStoryError('Некорректное количество глав: от ' + chapterMin + ' до ' + chapterMax);
      setGenerationMessage('Проверьте количество глав');
      return;
    }
    setChapterError('');

    try {
      if (hasPersonalData([ideaText, customGenre.trim() || genre, character, location]) || hasUnsafeNameInput(childName)) {
        throw new Error(PERSONAL_DATA_BLOCK_MESSAGE);
      }

      generationStartedAtRef.current = Date.now();
      setGenerationState('loading');
      setGenerationMessage('Отправка запроса...');
      setStoryResult('');
      setStoryError('');
      setSavedStoryId(null);
      setSaveError('');
      setSaveBlocked(false);
      setProgress(0);
      setDisplayProgress(0);
      displayValueRef.current = 0;
      progressRef.current = 0;

      const data = await generateStory({
        idea: ideaText,
        genre: customGenre.trim() || genre,
        ageGroup,
        chapters,
        character,
        location,
        childName: childName.trim() || undefined,
        childProfileId: childProfileId || undefined,
        characterIds: selectedCharacterIds.length > 0 ? selectedCharacterIds : undefined,
      });

      setJobId(data.jobId);
      setGenerationState('generating');
      setGenerationMessage('Задача поставлена в очередь...');
    } catch (error) {
      // При 401 централизованная обработка в AuthContext уже отправляет на /sign-in.
      // Не показываем красную карточку — страница всё равно перезагрузится.
      if (error.status === 401) {
        return;
      }
      setGenerationState('error');
      setStoryError(error.message || 'Не удалось запустить генерацию');
      setGenerationMessage(error.message || 'Не удалось запустить генерацию');
    }
  };

  // ─── characterVoices для ElevenLabsTTS ─────────────────────────────
  const computeCharacterVoices = useCallback(() => {
    const cv = {};
    for (const id of selectedCharacterIds) {
      const c = allCharacters.find(ch => ch.id === id);
      // Только персонажи с включённой озвучкой
      if (c && c.voiceEnabled && c.voiceId) cv[c.name] = c.voiceId;
    }
    return cv;
  }, [selectedCharacterIds, allCharacters]);

  // ─── «Удивите меня» — процедурная идея из тысяч сочетаний ─────────
  const handleSurpriseMe = () => {
    const surprise = createSurpriseStory(Math.random, recentSurpriseIdeasRef.current);
    recentSurpriseIdeasRef.current.add(surprise.idea);
    if (recentSurpriseIdeasRef.current.size > 24) {
      recentSurpriseIdeasRef.current.delete(recentSurpriseIdeasRef.current.values().next().value);
    }
    setIdeaText(surprise.idea);
    setGenre(surprise.genre);
    setCustomGenre('');
    setLocation(surprise.location);
  };

  const handleCancel = async () => {
    if (jobId) {
      try {
        await cancelStoryJob(jobId);
      } catch {
        // Ignore cancel errors
      }
    }
    stopPolling();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    generationStartedAtRef.current = null;
    setGenerationState('idle');
    setGenerationMessage('');
    setStoryResult('');
    setStoryError('');
    setJobId(null);
    setProgress(0);
    setDisplayProgress(0);
    displayValueRef.current = 0;
    progressRef.current = 0;
  };

  const handleSaveToLibrary = useCallback(async () => {
    if (!storyResult) return null;
    if (savedStoryId) return savedStoryId;
    if (savePromiseRef.current) return savePromiseRef.current;
    setIsSaving(true);
    setSaveError('');
    setSaveBlocked(false);

    const saveRequest = (async () => {
    try {
      const title = ideaText.trim()
        ? `Сказка: ${ideaText.trim().slice(0, 50)}${ideaText.trim().length > 50 ? '...' : ''}`
        : `Сказка от ${new Date().toLocaleDateString('ru-RU')}`;
      // Собираем известные имена для очистки перед foreign TTS
      const namesForTts = [];
      if (childName && childName.trim()) namesForTts.push(childName.trim());
      // Ищем выбранный профиль в загруженных профилях
      if (childProfileId && profiles.length > 0) {
        const profile = profiles.find(p => p.id === childProfileId);
        if (profile && profile.name && profile.name.trim() && !namesForTts.includes(profile.name.trim())) {
          namesForTts.push(profile.name.trim());
        }
      }
      // Добавляем имена выбранных персонажей
      if (selectedCharacterIds.length > 0 && allCharacters.length > 0) {
        for (const id of selectedCharacterIds) {
          const char = allCharacters.find(c => c.id === id);
          if (char && char.name && char.name.trim() && !namesForTts.includes(char.name.trim())) {
            namesForTts.push(char.name.trim());
          }
        }
      }

      const story = await createStory({
        title,
        content: storyResult,
        status: 'published',
        narratorVoiceId: voiceId,
        personalizationNames: namesForTts.length > 0 ? namesForTts : undefined,
        // Передаём jobId, чтобы backend гарантированно сохранил имена из job.params
        generationJobId: jobId || undefined,
      });
      setSavedStoryId(story.id);
      return story.id;
    } catch (error) {
      const message = error.message || 'Не удалось сохранить сказку';
      if (message === PERSONAL_DATA_BLOCK_MESSAGE) {
        setSaveBlocked(true);
        setSaveError('');
      } else {
        setSaveError(message);
      }
      return null;
    } finally {
      setIsSaving(false);
      savePromiseRef.current = null;
    }
    })();
    savePromiseRef.current = saveRequest;
    return saveRequest;
  }, [ideaText, savedStoryId, storyResult, voiceId, childName, childProfileId, profiles, selectedCharacterIds, allCharacters, jobId]);

  useEffect(() => {
    if (generationState === 'completed' && storyResult && !savedStoryId && !saveError && !saveBlocked) {
      void handleSaveToLibrary();
    }
  }, [generationState, handleSaveToLibrary, saveBlocked, saveError, savedStoryId, storyResult]);

  const handleOpenStory = () => {
    if (!savedStoryId) return;
    const editor = window.open(`/story-editor?id=${encodeURIComponent(savedStoryId)}`, '_blank', 'noopener,noreferrer');
    if (editor) editor.opener = null;
  };

  const handleReset = () => {
    stopPolling();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    generationStartedAtRef.current = null;
    setGenerationState('idle');
    setGenerationMessage('');
    setStoryResult('');
    setStoryError('');
    setJobId(null);
    setProgress(0);
    setDisplayProgress(0);
    displayValueRef.current = 0;
    progressRef.current = 0;
    setSavedStoryId(null);
    setIsSaving(false);
    setSaveError('');
    setSaveBlocked(false);
  };

  const genres = ['Сказка', 'Фэнтези', 'Приключение', 'Детектив', 'Научная фантастика', 'Исторический', 'Притча', 'Басня', 'Юмор', 'Мистика'];
  const ageGroups = ['3-5', '6-8', '9-12'];
  const selectedVoice = ttsVoices.find((voice) => voice.voiceId === voiceId) || DEFAULT_ELEVENLABS_VOICE;
  const childNameHasUnsafeInput = Boolean(childName.trim() && hasUnsafeNameInput(childName));
  const chapterMin = 1;
  const chapterMax = 10;
  const estimatedDuration = chapters <= 1
    ? '3-5 минут'
    : chapters <= 3
      ? '6-9 минут'
      : chapters <= 6
        ? '9-14 минут'
        : '15-25 минут';
  const locationTemplates = ['Лесная тропинка', 'Замок на холме', 'Дом у моря', 'Космос', 'Городской парк', 'Тихий сад'];

  const handleSectionToggle = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleNarratorVoiceSelect = useCallback((nextVoiceId) => {
    setVoiceId(nextVoiceId);
    setTtsVoicesError('');

    // If the generated story has already been auto-saved, keep the editor and
    // future audio generations in sync with the choice made on this screen.
    if (savedStoryId) {
      void updateStory(savedStoryId, { narratorVoiceId: nextVoiceId }).catch((error) => {
        setTtsVoicesError(error.message || 'Не удалось сохранить выбор рассказчика');
      });
    }
  }, [savedStoryId]);

  const handleRequestVoiceChange = useCallback(() => {
    setIsExtraOpen(true);
    setActiveSection('voice');
    window.requestAnimationFrame(() => {
      document.getElementById('generator-voice-settings')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, []);

  return (
    <div className="w-full max-w-[1220px] min-[2100px]:max-w-[1500px] min-[2400px]:max-w-[1800px] mx-auto bg-warm-peach border border-border-light rounded-panel p-4 md:p-6 lg:p-8 min-[2100px]:p-10 min-[2400px]:p-12 shadow-warm-md">
      
      {/* Верхняя служебная строка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-sep/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-title text-sm md:text-base">Рабочая область сказки</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-white/80 border border-border-light/40 rounded-full text-xs font-semibold text-text-secondary">{estimatedDuration}</span>
          <span className="px-3 py-1 bg-white/80 border border-border-light/40 rounded-full text-xs font-semibold text-text-secondary">добрый тон</span>
        </div>
      </div>

      {/* Поле идеи */}
      <div className="mt-6 bg-white border border-border-light rounded-inner p-4 md:p-5 shadow-inner">
        <div className="flex items-center justify-between mb-2">
          <label className="font-bold text-title text-sm md:text-base">Идея сказки</label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSurpriseMe}
              disabled={generationState === 'loading' || generationState === 'generating'}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all duration-150 flex items-center gap-1 disabled:opacity-40"
              title="Случайная идея"
            >
              <Sparkles className="w-3 h-3" />
              Удивите меня
            </button>
            {ideaText.trim() && (
              <button
                type="button"
                onClick={() => {
                  setIdeaText('');
                  if (generationState === 'error') {
                    setGenerationState('idle');
                    setStoryError('');
                    setGenerationMessage('');
                  }
                }}
                disabled={generationState === 'loading' || generationState === 'generating'}
                className="flex h-7 items-center justify-center gap-1 rounded-full border border-border-light bg-white px-2.5 text-xs font-semibold text-text-secondary transition-all hover:border-accent hover:bg-accent hover:text-white disabled:opacity-40"
                title="Очистить идею"
                aria-label="Очистить идею сказки"
              >
                <X className="h-3.5 w-3.5" />
                Очистить
              </button>
            )}
            <span className="text-xs text-text-secondary font-semibold">{ideaText.length}/700</span>
          </div>
        </div>
        <textarea
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value.slice(0, 700))}
          placeholder="Например: сказка про Арину, кролика в плаще и замок, где светятся добрые звезды..."
          className="w-full h-[150px] md:h-[190px] bg-transparent border-none outline-none resize-none text-text text-sm md:text-base placeholder-text-secondary/60 leading-relaxed"
        />
      </div>

      {/* Имя ребёнка — отдельный блок рядом с идеей */}
      <div className="mt-4 bg-white border border-border-light rounded-inner p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="flex-1">
            <label className="font-bold text-title text-sm md:text-base block mb-1">Имя ребёнка</label>
            <p className="text-xs text-text-secondary/70 mb-1">ИИ будет использовать его в сказке</p>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value.slice(0, 40))}
              placeholder="Не обязательно, например: Аня"
              className={`w-full max-w-[300px] px-3 py-2 bg-warm-inner/30 border rounded-lg text-sm text-text outline-none focus:bg-white transition-all ${
                childNameHasUnsafeInput ? 'border-red-300 focus:border-red-400' : 'border-border-light focus:border-accent'
              }`}
            />
            {childNameHasUnsafeInput && (
              <p className="mt-2 text-xs font-semibold text-red-500">{PERSONAL_DATA_BLOCK_MESSAGE}</p>
            )}
          </div>
        </div>
      </div>

      {/* Статус */}
      {generationState !== 'idle' && (
        <div className="mt-6 border border-border-light rounded-inner bg-white overflow-hidden shadow-sm">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-full shrink-0 ${
                generationState === 'completed' ? 'bg-green-100 text-green-600' :
                generationState === 'error' ? 'bg-red-100 text-red-500' :
                'bg-accent/10 text-accent'
              }`}>
                {generationState === 'completed' ? <CheckCircle className="w-6 h-6" /> :
                 generationState === 'error' ? <AlertCircle className="w-6 h-6" /> :
                 <Loader2 className="w-6 h-6 animate-spin" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-title text-sm md:text-base">{generationMessage}</p>
                {(generationState === 'generating' || generationState === 'loading') && (
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-accent h-2 rounded-full transition-none"
                      style={{ width: `${Math.max(5, displayProgress)}%` }}
                    />
                  </div>
                )}
                {generationState === 'error' && storyError && (
                  <p className="mt-1 text-sm text-red-500">{storyError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Результат */}
      {generationState === 'completed' && storyResult && (
        <div className="mt-6 border border-border-light rounded-inner bg-white overflow-hidden shadow-sm">
          <div className="px-5 py-4 bg-warm-inner/50 border-b border-border-light flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-title text-sm md:text-base">✨ Ваша сказка</span>
            <div className="flex items-center gap-2">
              {savedStoryId ? (
                <>
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Сохранено автоматически
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenStory}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-border-light text-text hover:border-accent hover:text-accent transition-all duration-150 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Редактировать текст
                  </button>
                </>
              ) : saveError ? (
                <button
                  onClick={handleSaveToLibrary}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-all duration-150 flex items-center gap-1 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3" />}
                  {isSaving ? 'Сохранение...' : 'Повторить сохранение'}
                </button>
              ) : saveBlocked ? (
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-warm-inner text-text-secondary flex items-center gap-1">
                  Требуется проверка
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-warm-inner text-text-secondary flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Сохраняем для озвучки…
                </span>
              )}
              {savedStoryId ? <StoryPdfButton storyId={savedStoryId} title={ideaText || 'Сказка'} /> : null}
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all duration-150 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Новая сказка
              </button>
            </div>
          </div>
          {saveError && (
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {saveError}
            </div>
          )}
          <div className="p-5 md:p-8 bg-gradient-to-b from-white to-warm-inner/10">
            <StoryText text={storyResult} />
          </div>
          <div className="px-5 py-3 bg-warm-inner/30 border-t border-border-light">
            {savedStoryId ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-title">Теперь можно послушать сказку</p>
                  <p className="text-xs text-text-secondary mt-0.5">Рассказчик уже выбран в настройках. Нажмите одну кнопку — готовый MP3 появится здесь.</p>
                </div>
                <ElevenLabsTTS
                  storyId={savedStoryId}
                  characterVoices={computeCharacterVoices()}
                  defaultVoiceId={voiceId}
                  selectedVoiceId={voiceId}
                  voices={ttsVoices}
                  onRequestVoiceChange={handleRequestVoiceChange}
                  downloadName={`Сказка — ${childName.trim() || 'ТвориСказку'}`}
                />
              </div>
            ) : saveBlocked ? (
              <p className="text-xs text-text-secondary flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-accent" />
                Проверьте текст перед сохранением и озвучкой.
              </p>
            ) : (
              <p className="text-xs text-text-secondary flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 text-accent animate-spin" /> : <Volume2 className="w-4 h-4 text-accent" />}
                {saveError ? 'Не удалось сохранить сказку — повторите сохранение выше.' : 'Сохраняем сказку и готовим панель озвучки…'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Кнопка */}
      {generationState !== 'completed' && (
      <div className="mt-6 flex justify-end gap-3">
        {generationState === 'loading' || generationState === 'generating' ? (
          <button
            onClick={handleCancel}
            className="px-6 py-3.5 rounded-full border border-border-light text-text-secondary font-semibold text-sm md:text-base hover:bg-gray-100 transition-all duration-200"
          >
            Отмена
          </button>
        ) : generationState === 'error' ? (
          <button
            onClick={handleGenerate}
            disabled={childNameHasUnsafeInput}
            className="px-6 py-3.5 rounded-full border border-red-200 text-red-600 font-semibold text-sm md:text-base hover:bg-red-50 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Попробовать снова
          </button>
        ) : null}
        <button
          onClick={handleGenerate}
          disabled={generationState === 'loading' || generationState === 'generating' || childNameHasUnsafeInput}
          className={`px-6 py-3.5 rounded-full font-bold text-sm md:text-base flex items-center gap-2 transition-all duration-200 shadow-warm-soft ${
            generationState === 'loading' || generationState === 'generating' || childNameHasUnsafeInput
              ? 'bg-accent/50 text-white cursor-not-allowed'
              : 'bg-accent hover:bg-accent-hover text-white hover:-translate-y-0.5 active:translate-y-0'
          }`}
        >
          {generationState === 'loading' || generationState === 'generating' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Генерация...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {generationState === 'error' ? 'Попробовать снова' : (user ? 'Создать сказку' : 'Войти для создания')}
            </>
          )}
        </button>
      </div>
      )}

      {/* Настройки */}
      <div className="mt-6 border border-border-light rounded-inner bg-white overflow-hidden shadow-sm">
        <button
          onClick={() => setIsExtraOpen(!isExtraOpen)}
          className="w-full px-5 py-4 bg-warm-inner/50 hover:bg-warm-inner flex items-center justify-between border-b border-border-light transition-colors duration-150"
        >
          <span className="font-bold text-title text-sm md:text-base">Настройки</span>
          {isExtraOpen ? <ChevronUp className="w-5 h-5 text-accent" /> : <ChevronDown className="w-5 h-5 text-accent" />}
        </button>

        {isExtraOpen && (
          <div className="divide-y divide-border-soft">
            
            {/* 1. Жанр */}
            <div className="transition-all duration-200">
              <button
                onClick={() => handleSectionToggle('genre')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-inner/20 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="w-32 md:w-36 shrink-0 text-xs md:text-sm font-bold text-text-secondary uppercase tracking-wider">Жанр</span>
                  <span className="text-sm md:text-base font-semibold text-title">{customGenre.trim() || genre}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${activeSection === 'genre' ? 'rotate-180' : ''}`} />
              </button>
              {activeSection === 'genre' && (
                <div className="px-5 pb-5 pt-2 bg-warm-inner/10">
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          setGenre(g);
                          setCustomGenre('');
                          setIsCustomGenreOpen(false);
                        }}
                        className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold border transition-all duration-150 ${
                          genre === g && !customGenre.trim()
                            ? 'bg-accent border-accent text-white shadow-sm'
                            : 'bg-white border-border-light text-text hover:border-accent hover:text-accent'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                    <button
                      onClick={() => setIsCustomGenreOpen(true)}
                      className="px-4 py-2 rounded-full text-xs md:text-sm font-bold border border-dashed border-accent text-accent hover:bg-accent hover:text-white flex items-center gap-1 transition-all duration-150"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Свой вариант
                    </button>
                  </div>
                  {isCustomGenreOpen && (
                    <div className="mt-4 max-w-md">
                      <input
                        type="text"
                        value={customGenre}
                        onChange={(e) => setCustomGenre(e.target.value)}
                        placeholder="Например: семейная притча, мистическая история, сказочный детектив"
                        className="w-full px-4 py-2.5 bg-white border border-border-light rounded-lg text-sm text-text outline-none focus:border-accent transition-colors shadow-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Возрастная группа */}
            <div className="transition-all duration-200">
              <button
                onClick={() => handleSectionToggle('age')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-inner/20 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="w-32 md:w-36 shrink-0 text-xs md:text-sm font-bold text-text-secondary uppercase tracking-wider">Возрастная группа</span>
                  <span className="text-sm md:text-base font-semibold text-title">{ageGroup} лет</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${activeSection === 'age' ? 'rotate-180' : ''}`} />
              </button>
              {activeSection === 'age' && (
                <div className="px-5 pb-5 pt-2 bg-warm-inner/10">
                  <div className="flex flex-wrap gap-2">
                    {ageGroups.map((a) => (
                      <button
                        key={a}
                        onClick={() => setAgeGroup(a)}
                        className={`px-5 py-2 rounded-full text-xs md:text-sm font-semibold border transition-all duration-150 ${
                          ageGroup === a
                            ? 'bg-accent border-accent text-white shadow-sm'
                            : 'bg-white border-border-light text-text hover:border-accent hover:text-accent'
                        }`}
                      >
                        {a} лет
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Озвучка */}
            <div id="generator-voice-settings" className="transition-all duration-200 scroll-mt-28">
              <button
                onClick={() => handleSectionToggle('voice')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-inner/20 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="w-32 md:w-36 shrink-0 text-xs md:text-sm font-bold text-text-secondary uppercase tracking-wider">Озвучка</span>
                    <span className="text-sm md:text-base font-semibold text-title">{selectedVoice.name} · студийный голос</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${activeSection === 'voice' ? 'rotate-180' : ''}`} />
              </button>
              {activeSection === 'voice' && (
                <div className="px-5 pb-5 pt-2 bg-warm-inner/10">
                  <p className="text-xs text-text-secondary mb-3">Послушайте демо и выберите характер голоса. По умолчанию используется добрый рассказчик.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {ttsVoices.map((voice) => (
                      <div
                        key={voice.voiceId}
                        className={`min-w-0 rounded-xl border p-2.5 flex items-center gap-2 transition-colors ${
                          voiceId === voice.voiceId
                            ? 'bg-accent/10 border-accent shadow-sm'
                            : 'bg-white border-border-light hover:border-accent/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleNarratorVoiceSelect(voice.voiceId)}
                          disabled={ttsVoicesLoading}
                          className="min-w-0 flex-1 text-left disabled:opacity-60"
                        >
                          <span className="block text-sm font-bold text-title truncate">{voice.name}</span>
                          <span className="block text-[11px] text-text-secondary truncate">{voice.description}</span>
                        </button>
                        <VoicePreviewButton voice={voice} compact />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-text-secondary">Кнопка ▶ воспроизводит демо и не расходует лимит озвучек.</p>
                  {ttsVoicesError && <p className="mt-2 text-xs text-red-500">{ttsVoicesError}</p>}
                </div>
              )}            </div>

            {/* 4. Главы */}
            <div className="transition-all duration-200">
              <button
                onClick={() => handleSectionToggle('chapters')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-inner/20 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="w-32 md:w-36 shrink-0 text-xs md:text-sm font-bold text-text-secondary uppercase tracking-wider">Главы</span>
                  <span className="text-sm md:text-base font-semibold text-title">{chapters} {chapters === 1 ? 'глава' : chapters <= 4 ? 'главы' : 'глав'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${activeSection === 'chapters' ? 'rotate-180' : ''}`} />
              </button>
              {activeSection === 'chapters' && (
                <div className="px-5 pb-5 pt-2 bg-warm-inner/10">
                  {/* Быстрый выбор */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[3, 5, 7, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setChapterError('');
                          const count = Math.min(n, chapterMax);
                          setChapters(count);
                          setChaptersInput(String(count));
                        }}
                        className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold border transition-all duration-150 ${
                          chapters === n
                            ? 'bg-accent border-accent text-white shadow-sm'
                            : 'bg-white border-border-light text-text hover:border-accent hover:text-accent'
                        }`}
                      >
                        {n} {n === 1 ? 'глава' : n <= 4 ? 'главы' : 'глав'}
                      </button>
                    ))}
                  </div>
                  <div className="max-w-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setChapterError('');
                          const next = Math.max(chapterMin, chapters - 1);
                          setChapters(next);
                          setChaptersInput(String(next));
                        }}
                        disabled={chapters <= chapterMin}
                        className="w-9 h-9 rounded-full border border-border-light flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={chaptersInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Разрешаем пустую строку (пользователь стирает цифру) и только цифры
                          if (val === '' || /^\d+$/.test(val)) {
                            setChaptersInput(val);
                          }
                        }}
                        onBlur={() => {
                          const raw = chaptersInput.trim();
                          if (raw === '') {
                            setChapterError('Укажите количество глав');
                            return;
                          }
                          const num = parseInt(raw, 10);
                          if (isNaN(num)) {
                            setChapterError('Введите число');
                            return;
                          }
                          if (num < chapterMin || num > chapterMax) {
                            setChapterError('От 1 до 10 глав');
                            return;
                          }
                          setChapterError('');
                          setChapters(num);
                          setChaptersInput(String(num));
                        }}
                        className="w-16 text-center px-3 py-2 bg-white border border-border-light rounded-lg text-sm text-text outline-none focus:border-accent transition-colors shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setChapterError('');
                          const next = Math.min(chapterMax, chapters + 1);
                          setChapters(next);
                          setChaptersInput(String(next));
                        }}
                        disabled={chapters >= chapterMax}
                        className="w-9 h-9 rounded-full border border-border-light flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                    {chapterError && (
                      <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {chapterError}
                      </p>
                    )}
                    {!chapterError && (
                      <p className="mt-2 text-xs text-text-secondary">От {chapterMin} до {chapterMax}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Персонализация (профиль + персонажи) */}
            <div className="transition-all duration-200">
              <button
                onClick={() => handleSectionToggle('characters')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-inner/20 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="w-32 md:w-36 shrink-0 text-xs md:text-sm font-bold text-text-secondary uppercase tracking-wider">Персонализация</span>
                  <span className="text-sm md:text-base font-semibold text-title">
                    {childProfileId ? profiles.find((p) => p.id === childProfileId)?.name || 'Выбран' : 'Не выбрана'}
                    {selectedCharacterIds.length > 0 ? ` +${selectedCharacterIds.length}` : ''}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${activeSection === 'characters' ? 'rotate-180' : ''}`} />
              </button>
              {activeSection === 'characters' && (
                <div className="px-5 pb-5 pt-4 bg-warm-inner/10">
                  {/* Профили детей */}
                  <h5 className="font-bold text-title text-sm mb-1">Профиль ребёнка</h5>
                  {profilesLoading ? (
                    <p className="text-xs text-text-secondary mb-3 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Загрузка...</p>
                  ) : profilesError ? (
                    <p className="text-xs text-red-500 mb-3 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {profilesError}</p>
                  ) : profiles.length === 0 ? (
                    <p className="text-xs text-text-secondary mb-3">Нет профилей.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {profiles.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProfile(p.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            childProfileId === p.id
                              ? 'bg-accent border-accent text-white'
                              : 'bg-white border-border-light text-text hover:border-accent'
                          }`}
                        >
                          {p.name} {p.ageGroup ? `(${p.ageGroup} лет)` : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Персонажи */}
                  <h5 className="font-bold text-title text-sm mb-1 mt-4">Персонажи</h5>
                  {charactersLoading ? (
                    <p className="text-xs text-text-secondary mb-3 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Загрузка...</p>
                  ) : charactersError ? (
                    <p className="text-xs text-red-500 mb-3 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {charactersError}</p>
                  ) : displayedCharacters.length === 0 ? (
                    <p className="text-xs text-text-secondary mb-3">
                      {childProfileId ? 'Нет персонажей для этого профиля.' : 'Нет персонажей.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {displayedCharacters.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleToggleCharacter(c.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            selectedCharacterIds.includes(c.id)
                              ? 'bg-accent border-accent text-white'
                              : 'bg-white border-border-light text-text hover:border-accent'
                          }`}
                        >
                          {c.name}{c.role ? ` (${c.role})` : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  {(childProfileId || selectedCharacterIds.length > 0) && (
                    <button
                      onClick={() => { setChildProfileId(''); setSelectedCharacterIds([]); }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                    >
                      Сбросить выбор
                    </button>
                  )}

                  <div className="mt-4 pt-3 border-t border-border-light/60">
                    <button
                      onClick={() => navigate('/story-characters')}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-accent hover:bg-accent-hover text-white flex items-center gap-1.5 transition-all duration-150 shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Управлять профилями
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Место действия */}
            <div className="transition-all duration-200">
              <button
                onClick={() => handleSectionToggle('location')}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-warm-inner/20 text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="w-32 md:w-36 shrink-0 text-xs md:text-sm font-bold text-text-secondary uppercase tracking-wider">Место</span>
                  <span className="text-sm md:text-base font-semibold text-title">{location}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${activeSection === 'location' ? 'rotate-180' : ''}`} />
              </button>
              {activeSection === 'location' && (
                <div className="px-5 pb-5 pt-2 bg-warm-inner/10">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {locationTemplates.map((item) => (
                      <button
                        key={item}
                        onClick={() => setLocation(item)}
                        className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold border transition-all duration-150 ${
                          location === item
                            ? 'bg-accent border-accent text-white shadow-sm'
                            : 'bg-white border-border-light text-text hover:border-accent hover:text-accent'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="max-w-lg">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Или напишите свой вариант"
                      className="w-full px-4 py-2.5 bg-white border border-border-light rounded-lg text-sm text-text outline-none focus:border-accent transition-colors shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
