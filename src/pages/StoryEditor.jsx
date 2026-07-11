import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Loader2, AlertCircle, Trash2, BookOpen, CheckCircle, Volume2 } from 'lucide-react';
import { getStory, updateStory, deleteStory, getCharacters } from '../api.js';
import ElevenLabsTTS from '../components/ElevenLabsTTS.jsx';
import StoryPdfButton from '../components/StoryPdfButton.jsx';
import { DEFAULT_ELEVENLABS_VOICE_ID } from '../tts-config.js';

export default function StoryEditor({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get('id');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storyLoaded, setStoryLoaded] = useState(false);
  const [characterVoices, setCharacterVoices] = useState({});
  const [narratorVoiceId, setNarratorVoiceId] = useState(DEFAULT_ELEVENLABS_VOICE_ID);

  const fetchStory = useCallback(async () => {
    if (!storyId) {
      setError('Не указан идентификатор сказки');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [story, characters] = await Promise.all([
        getStory(storyId),
        getCharacters().catch(() => []),
      ]);
      setTitle(story.title);
      setContent(story.content);
      setStatus(story.status);
      setNarratorVoiceId(story.narratorVoiceId || DEFAULT_ELEVENLABS_VOICE_ID);
      const enabledCharacters = characters.filter((character) => character.voiceEnabled && character.voiceId);
      const mentionedCharacters = enabledCharacters.filter((character) => story.content.includes(character.name));
      const relevantCharacters = mentionedCharacters.length > 0 ? mentionedCharacters : enabledCharacters;
      setCharacterVoices(Object.fromEntries(
        relevantCharacters.map((character) => [character.name, character.voiceId]),
      ));
      setStoryLoaded(true);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить сказку');
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Название не может быть пустым');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      const updated = await updateStory(storyId, {
        title: title.trim(),
        content,
        status,
      });
      setTitle(updated.title);
      setContent(updated.content);
      setStatus(updated.status);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить эту сказку? Это действие нельзя отменить.')) return;

    setDeleting(true);
    setError('');

    try {
      await deleteStory(storyId);
      navigate('/tvoriskazku-tales');
    } catch (err) {
      setError(err.message || 'Не удалось удалить сказку');
      setDeleting(false);
    }
  };

  const handleStatusToggle = () => {
    setStatus((prev) => (prev === 'draft' ? 'published' : 'draft'));
  };

  const handleNarratorVoiceChange = async (nextVoiceId) => {
    const previousVoiceId = narratorVoiceId;
    setNarratorVoiceId(nextVoiceId);
    setError('');
    try {
      await updateStory(storyId, { narratorVoiceId: nextVoiceId });
    } catch (err) {
      setNarratorVoiceId(previousVoiceId);
      setError(err.message || 'Не удалось сохранить выбранный голос');
    }
  };

  // Загрузка
  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
          <p className="text-text-secondary text-sm">Загрузка сказки...</p>
        </div>
      </div>
    );
  }

  // Ошибка загрузки
  if (error && !storyLoaded) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
        <div className="bg-red-50 border border-red-200 rounded-panel p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-title text-sm">Ошибка загрузки</p>
            <p className="text-sm text-text-secondary mt-1">{error}</p>
            <button
              onClick={() => navigate('/tvoriskazku-tales')}
              className="mt-3 text-sm font-semibold text-accent hover:text-accent-hover flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Вернуться в библиотеку
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
      
      {/* Навигация */}
      <button
        onClick={() => navigate('/tvoriskazku-tales')}
        className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Вернуться в библиотеку
      </button>

      {/* Редактор */}
      <div className="bg-white border border-border-light rounded-panel shadow-warm-soft overflow-hidden">
        
        {/* Шапка редактора */}
        <div className="px-6 md:px-8 py-5 bg-warm-inner/50 border-b border-border-light flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
              {storyLoaded && content ? <StoryPdfButton storyId={storyId} title={title} /> : null}
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white shadow-sm shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-title text-lg md:text-xl font-bold text-title">Редактор сказки</h1>
              <p className="text-xs text-text-secondary">Редактируйте название, текст и статус</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStatusToggle}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all duration-150 ${
                status === 'published'
                  ? 'bg-green-100 border-green-200 text-green-700 hover:bg-green-200'
                  : 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'
              }`}
            >
              {status === 'published' ? '✓ Готово' : '✎ Черновик'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-full text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition-all duration-150 disabled:opacity-50 flex items-center gap-1"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {deleting ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>

        {/* Тело редактора */}
        <div className="p-6 md:p-8">
          {/* Сообщение об успехе */}
          {saveSuccess && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-inner flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Изменения сохранены
            </div>
          )}

          {/* Ошибка */}
          {error && storyLoaded && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-inner flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Название */}
          <div className="mb-6">
            <label className="block font-bold text-title text-sm mb-2">Название сказки</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название..."
              maxLength={300}
              className="w-full px-4 py-3 bg-warm-inner/30 border border-border-light rounded-lg text-sm text-text outline-none focus:border-accent focus:bg-white transition-all"
            />
          </div>

          {/* Текст сказки */}
          <div className="mb-6">
            <label className="block font-bold text-title text-sm mb-2">Текст сказки</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Текст сказки..."
              className="w-full min-h-[400px] px-4 py-3 bg-warm-inner/30 border border-border-light rounded-lg text-sm text-text outline-none focus:border-accent focus:bg-white transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm flex items-center gap-2 shadow-warm-soft transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:-translate-y-0"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>

        {/* Информация */}
          {/* Speech controls */}
          <div className="px-6 md:px-8 py-3 bg-warm-inner/30 border-t border-border-light">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Профессиональная озвучка</span>
            </div>
            {storyId && (
              <div className="mt-3 pt-3 border-t border-border-light/60">
                <ElevenLabsTTS
                  storyId={storyId}
                  characterVoices={characterVoices}
                  selectedVoiceId={narratorVoiceId}
                  onVoiceChange={handleNarratorVoiceChange}
                  downloadName={title || 'Сказка'}
                />
              </div>
            )}
          </div>

          <div className="px-6 md:px-8 py-4 bg-warm-inner/30 border-t border-border-light text-xs text-text-secondary flex items-center gap-4">
          <span>Статус: <strong className="text-title">{status === 'published' ? 'Готово' : 'Черновик'}</strong></span>
        </div>      </div>
      
    </div>
  );
}
