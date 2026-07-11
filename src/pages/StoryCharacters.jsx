import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Heart, Loader2, Pencil, Shield, Sparkles, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import { createCharacter, createProfile, deleteCharacter, deleteProfile, getCharacters, getProfiles, getTtsVoices, updateCharacter, updateProfile } from '../api.js';
import { NO_AVATAR_ID, PRESET_AVATARS, getPresetAvatar } from '../lib/preset-avatars.js';
import { hasPersonalData, hasUnsafeNameInput, PERSONAL_DATA_BLOCK_MESSAGE } from '../lib/personal-data-filter.js';

const AGE_GROUPS = ['3-5', '6-8', '9-12'];

const CHARACTER_SURPRISES = [
  {
    name: 'Тихий дракончик Тиша',
    role: 'добрый спутник',
    description: 'Светло-зелёный дракончик, который выращивает светящиеся цветы и находит дорогу в темноте.',
    traits: 'заботливый, застенчивый, наблюдательный, смелый',
    interests: 'волшебные растения, карты, звёзды, подземные библиотеки',
    presetAvatarId: 'dragon-flower',
  },
  {
    name: 'Лисёнок Фонарик',
    role: 'лучший друг героя',
    description: 'Рыжий лисёнок в плаще с фонариком тёплого золотого света.',
    traits: 'любопытный, весёлый, находчивый, озорной',
    interests: 'секретные двери, загадки, ночные прогулки, печенье с корицей',
    presetAvatarId: 'fox-lantern',
  },
  {
    name: 'Сова Профессор Уху',
    role: 'мудрый советчик',
    description: 'Пушистая сова в очках, которая помогает героям думать сердцем.',
    traits: 'мудрая, терпеливая, внимательная, добрая',
    interests: 'книги, старинные карты, звёздное небо, добрые советы',
    presetAvatarId: 'owl-books',
  },
  {
    name: 'Мишка Мармелад',
    role: 'хранитель уюта',
    description: 'Мягкий медвежонок с сердцем, который умеет мирить друзей и заваривать лесной чай.',
    traits: 'тёплый, верный, смелый, спокойный',
    interests: 'чайные домики, мёд, семейные праздники, волшебные колыбельные',
    presetAvatarId: 'bear-heart',
  },
  {
    name: 'Енот Часик',
    role: 'хранитель времени',
    description: 'Енот с золотыми часами, который знает, где спрятаны потерянные минуты.',
    traits: 'точный, добрый, осторожный, изобретательный',
    interests: 'тайные расписания, башни с часами, путешествия, загадки',
    presetAvatarId: 'raccoon-clock',
  },
  {
    name: 'Зайчик Лучик',
    role: 'маленький волшебник',
    description: 'Зайчик с серебряной палочкой, который зажигает звёзды на добрые поступки.',
    traits: 'нежный, смелый, радостный, внимательный',
    interests: 'звёзды, цветы, фокусы, добрые обещания',
    presetAvatarId: 'bunny-wizard',
  },
];

function emptyProfile() {
  return {
    name: '',
    ageGroup: '6-8',
    interests: '',
    favoriteThemes: '',
    description: '',
    presetAvatarId: NO_AVATAR_ID,
  };
}

function emptyCharacter() {
  return {
    name: '',
    childProfileId: '',
    role: '',
    description: '',
    traits: '',
    interests: '',
    presetAvatarId: NO_AVATAR_ID,
    voiceId: '',
    voiceEnabled: false,
  };
}

function AvatarSelector({ value, onChange, compact = false }) {
  const scrollerRef = useRef(null);
  const options = [
    { id: NO_AVATAR_ID, name: 'Без аватара', image: null },
    ...PRESET_AVATARS,
  ];
  const scroll = (direction) => {
    scrollerRef.current?.scrollBy({
      left: direction * (compact ? 420 : 520),
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative rounded-2xl border border-border-light bg-warm-inner/30 px-10 py-3">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-light bg-white text-accent shadow-sm transition-all hover:bg-accent hover:text-white"
        aria-label="Показать предыдущие аватары"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:thin]"
      >
        {options.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onChange(avatar.id)}
            className={`w-28 shrink-0 rounded-2xl border bg-white p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-warm-soft md:w-32 ${
              value === avatar.id ? 'border-accent ring-2 ring-accent/20' : 'border-border-light'
            }`}
          >
            {avatar.image ? (
              <img src={avatar.image} alt={avatar.name} className="h-24 w-full rounded-xl object-cover md:h-28" />
            ) : (
              <span className="flex h-24 w-full items-center justify-center rounded-xl bg-accent/10 text-accent md:h-28">
                <User className="h-8 w-8" />
              </span>
            )}
            <span className="mt-2 block truncate text-[11px] font-bold text-title">{avatar.name}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-light bg-white text-accent shadow-sm transition-all hover:bg-accent hover:text-white"
        aria-label="Показать следующие аватары"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function AvatarImage({ avatarId, alt }) {
  const avatar = getPresetAvatar(avatarId);
  if (!avatar) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-accent/10 text-accent">
        <User className="h-10 w-10" />
      </span>
    );
  }
  return <img src={avatar.image} alt={alt || avatar.name} className="h-full w-full object-cover" />;
}

function hasUnsafeProfileInput(data) {
  return hasUnsafeNameInput(data.name)
    || hasPersonalData([data.interests, data.favoriteThemes, data.description]);
}

function hasUnsafeCharacterInput(data) {
  return hasUnsafeNameInput(data.name)
    || hasPersonalData([data.role, data.description, data.traits, data.interests]);
}

export default function StoryCharacters({ navigate }) {
  const [activeTab, setActiveTab] = useState('profiles');
  const [profiles, setProfiles] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [charLoading, setCharLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [formData, setFormData] = useState(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [charShowForm, setCharShowForm] = useState(false);
  const [editingChar, setEditingChar] = useState(null);
  const [charFormData, setCharFormData] = useState(emptyCharacter);
  const [charSaving, setCharSaving] = useState(false);
  const [deletingCharId, setDeletingCharId] = useState(null);

  const [ttsVoices, setTtsVoices] = useState([]);
  const [ttsVoicesLoading, setTtsVoicesLoading] = useState(true);
  const [ttsVoicesError, setTtsVoicesError] = useState('');

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfiles(await getProfiles());
    } catch (err) {
      setError(err.message || 'Не удалось загрузить профили');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCharacters = useCallback(async () => {
    setCharLoading(true);
    setError('');
    try {
      setCharacters(await getCharacters());
    } catch (err) {
      setError(err.message || 'Не удалось загрузить персонажей');
    } finally {
      setCharLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
    void fetchCharacters();
  }, [fetchCharacters, fetchProfiles]);

  useEffect(() => {
    let cancelled = false;
    setTtsVoicesLoading(true);
    getTtsVoices()
      .then((voices) => {
        if (!cancelled) setTtsVoices(voices.filter((voice) => voice.available));
      })
      .catch((err) => {
        if (!cancelled) setTtsVoicesError(err.message || 'Не удалось загрузить каталог голосов');
      })
      .finally(() => {
        if (!cancelled) setTtsVoicesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const profileCountText = useMemo(() => {
    if (!profiles.length) return 'Нет профилей';
    if (profiles.length === 1) return '1 профиль';
    if (profiles.length < 5) return `${profiles.length} профиля`;
    return `${profiles.length} профилей`;
  }, [profiles.length]);

  const resetProfileForm = () => {
    setFormData(emptyProfile());
    setEditingProfile(null);
    setShowForm(false);
  };

  const resetCharacterForm = () => {
    setCharFormData(emptyCharacter());
    setEditingChar(null);
    setCharShowForm(false);
  };

  const handleEditProfile = (profile) => {
    setFormData({
      name: profile.name || '',
      ageGroup: profile.ageGroup || '6-8',
      interests: profile.interests || '',
      favoriteThemes: profile.favoriteThemes || '',
      description: profile.description || '',
      presetAvatarId: profile.presetAvatarId || NO_AVATAR_ID,
    });
    setEditingProfile(profile);
    setShowForm(true);
  };

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      setError('Имя обязательно');
      return;
    }
    if (hasUnsafeProfileInput(formData)) {
      setError(PERSONAL_DATA_BLOCK_MESSAGE);
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingProfile) {
        const updated = await updateProfile(editingProfile.id, formData);
        setProfiles((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createProfile(formData);
        setProfiles((items) => [created, ...items]);
      }
      resetProfileForm();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (id) => {
    if (!window.confirm('Удалить этот профиль?')) return;
    setDeletingId(id);
    setError('');
    try {
      await deleteProfile(id);
      setProfiles((items) => items.filter((item) => item.id !== id));
      setCharacters((items) => items.map((item) => (item.childProfileId === id ? { ...item, childProfileId: null } : item)));
    } catch (err) {
      setError(err.message || 'Не удалось удалить профиль');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditCharacter = (character) => {
    setCharFormData({
      name: character.name || '',
      childProfileId: character.childProfileId || '',
      role: character.role || '',
      description: character.description || '',
      traits: character.traits || '',
      interests: character.interests || '',
      presetAvatarId: character.presetAvatarId || NO_AVATAR_ID,
      voiceId: character.voiceId || '',
      voiceEnabled: Boolean(character.voiceEnabled),
    });
    setEditingChar(character);
    setCharShowForm(true);
  };

  const surpriseCharacter = () => {
    const preset = CHARACTER_SURPRISES[Math.floor(Math.random() * CHARACTER_SURPRISES.length)];
    setActiveTab('characters');
    setEditingChar(null);
    setCharFormData((previous) => ({
      ...emptyCharacter(),
      ...preset,
      childProfileId: previous.childProfileId || profiles[0]?.id || '',
      voiceId: previous.voiceId,
      voiceEnabled: previous.voiceEnabled,
    }));
    setCharShowForm(true);
  };

  const handleSaveCharacter = async () => {
    if (!charFormData.name.trim()) {
      setError('Имя обязательно');
      return;
    }
    if (hasUnsafeCharacterInput(charFormData)) {
      setError(PERSONAL_DATA_BLOCK_MESSAGE);
      return;
    }
    if (charFormData.voiceEnabled && !charFormData.voiceId) {
      setError('Выберите готовый голос для персонажа');
      return;
    }

    const data = { ...charFormData };
    if (!data.childProfileId) delete data.childProfileId;

    setCharSaving(true);
    setError('');
    try {
      if (editingChar) {
        const updated = await updateCharacter(editingChar.id, data);
        setCharacters((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createCharacter(data);
        setCharacters((items) => [created, ...items]);
      }
      resetCharacterForm();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить персонажа');
    } finally {
      setCharSaving(false);
    }
  };

  const handleDeleteCharacter = async (id) => {
    if (!window.confirm('Удалить этого персонажа?')) return;
    setDeletingCharId(id);
    setError('');
    try {
      await deleteCharacter(id);
      setCharacters((items) => items.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || 'Не удалось удалить персонажа');
    } finally {
      setDeletingCharId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 md:px-12 md:py-16 lg:px-16">
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-bold text-accent shadow-sm transition-all duration-150 hover:bg-accent hover:text-white active:bg-white active:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        ← Назад
      </button>

      <div className="mb-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col lg:col-span-5">
          <span className="text-xs font-bold uppercase tracking-wider text-accent md:text-sm">Профили и герои</span>
          <h1 className="mt-2 font-title text-3xl font-bold leading-tight text-title md:text-4xl lg:text-5xl">
            Готовые персонажи для добрых сказок
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-text md:text-base">
            Выберите возрастную группу, добавьте интересы и подберите героев из готовой библиотеки аватаров.
          </p>
        </div>

        <div className="rounded-panel border border-border-light bg-white p-6 shadow-warm-soft md:p-8 lg:col-span-7">
          <div className="rounded-full border border-border-light/60 bg-warm-inner/40 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-title md:text-base">{profileCountText}</span>
              <User className="h-4 w-4 text-accent" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 flex border-b border-border-soft">
        <button
          onClick={() => {
            setActiveTab('profiles');
            resetCharacterForm();
          }}
          className={`flex items-center gap-2 border-b-2 px-6 pb-3 text-sm font-bold transition-all duration-200 ${
            activeTab === 'profiles' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-accent'
          }`}
        >
          <User className="h-4 w-4" />
          Профили детей
        </button>
        <button
          onClick={() => {
            setActiveTab('characters');
            resetProfileForm();
          }}
          className={`flex items-center gap-2 border-b-2 px-6 pb-3 text-sm font-bold transition-all duration-200 ${
            activeTab === 'characters' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-accent'
          }`}
        >
          <Users className="h-4 w-4" />
          Персонажи
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-inner border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {activeTab === 'profiles' && (
        <>
          {!showForm && (
            <div className="mb-8 flex justify-end">
              <button
                onClick={() => {
                  resetProfileForm();
                  setShowForm(true);
                }}
                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-warm-soft transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <UserPlus className="h-4 w-4" />
                Добавить профиль
              </button>
            </div>
          )}

          {showForm && (
            <div className="mb-8 rounded-panel border border-border-light bg-white p-6 shadow-warm-soft md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-title text-xl font-bold text-title">{editingProfile ? 'Редактировать профиль' : 'Новый профиль'}</h2>
                <button onClick={resetProfileForm} className="rounded-full p-2 text-text-secondary transition-colors hover:bg-warm-inner hover:text-accent">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-title">Имя *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="Имя ребёнка"
                    className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-title">Возрастная группа</label>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setFormData((previous) => ({ ...previous, ageGroup: group }))}
                        className={`rounded-full border px-4 py-2 text-sm font-bold transition-all ${
                          formData.ageGroup === group ? 'border-accent bg-accent text-white' : 'border-border-light bg-white text-text hover:border-accent hover:text-accent'
                        }`}
                      >
                        {group} лет
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-bold text-title">Аватар</label>
                <AvatarSelector
                  value={formData.presetAvatarId}
                  onChange={(presetAvatarId) => setFormData((previous) => ({ ...previous, presetAvatarId }))}
                  compact
                />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-bold text-title">Интересы</label>
                <input
                  type="text"
                  value={formData.interests}
                  onChange={(event) => setFormData((previous) => ({ ...previous, interests: event.target.value }))}
                  placeholder="Любимые занятия, игрушки, увлечения"
                  className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-bold text-title">Любимые темы</label>
                <input
                  type="text"
                  value={formData.favoriteThemes}
                  onChange={(event) => setFormData((previous) => ({ ...previous, favoriteThemes: event.target.value }))}
                  placeholder="Космос, динозавры, лесные приключения"
                  className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white"
                />
              </div>

              <div className="mb-6">
                <label className="mb-1 block text-sm font-bold text-title">Дополнительное описание</label>
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Что стоит учитывать в сказках"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={resetProfileForm} className="rounded-full border border-border-light px-5 py-2.5 text-sm font-semibold text-text-secondary transition-all hover:bg-warm-inner">
                  Отмена
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-warm-soft transition-all hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {saving ? 'Сохранение...' : editingProfile ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-text-secondary">Загрузка профилей...</p>
            </div>
          )}

          {!loading && profiles.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warm-peach">
                <User className="h-10 w-10 text-accent" />
              </div>
              <h3 className="mb-2 font-title text-xl font-bold text-title">Пока нет профилей</h3>
              <p className="mb-6 max-w-md text-center text-sm text-text-secondary">Создайте профиль с возрастной группой и готовым аватаром.</p>
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-warm-soft transition-all hover:bg-accent-hover">
                <UserPlus className="h-4 w-4" />
                Создать первый профиль
              </button>
            </div>
          )}

          {!loading && profiles.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex flex-col rounded-card border border-border-light bg-white p-5 shadow-warm-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-warm-md">
                  <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-warm-inner">
                    <AvatarImage avatarId={profile.presetAvatarId || NO_AVATAR_ID} alt={profile.name} />
                  </div>
                  <h3 className="font-title text-lg font-bold text-title">{profile.name}</h3>
                  <p className="mt-1 text-xs text-text-secondary">Возрастная группа: {profile.ageGroup || '6-8'} лет</p>
                  {profile.interests && <p className="mt-1 line-clamp-2 text-xs text-text-secondary"><span className="font-semibold">Интересы:</span> {profile.interests}</p>}
                  {profile.favoriteThemes && <p className="mt-1 line-clamp-1 text-xs text-text-secondary"><span className="font-semibold">Темы:</span> {profile.favoriteThemes}</p>}
                  {profile.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{profile.description}</p>}

                  <div className="mt-4 flex items-center gap-2 border-t border-border-light/60 pt-3">
                    <button onClick={() => handleEditProfile(profile)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-all duration-150 hover:bg-accent hover:text-white">
                      <Pencil className="h-3 w-3" />
                      Редактировать
                    </button>
                    <button onClick={() => handleDeleteProfile(profile.id)} disabled={deletingId === profile.id} className="rounded-full border border-border-light px-3 py-2 text-xs font-bold text-text-secondary transition-all duration-150 hover:border-red-200 hover:text-red-500">
                      {deletingId === profile.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'characters' && (
        <>
          {!charShowForm && (
            <div className="mb-8 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={surpriseCharacter}
                className="flex items-center gap-2 rounded-full border border-accent/30 bg-white px-5 py-2.5 text-sm font-bold text-accent shadow-warm-soft transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-white"
              >
                <Sparkles className="h-4 w-4" />
                Удивите меня
              </button>
              <button
                onClick={() => {
                  resetCharacterForm();
                  setCharShowForm(true);
                }}
                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-warm-soft transition-all hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                <UserPlus className="h-4 w-4" />
                Добавить персонажа
              </button>
            </div>
          )}

          {charShowForm && (
            <div className="mb-8 rounded-panel border border-border-light bg-white p-6 shadow-warm-soft md:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-title text-xl font-bold text-title">{editingChar ? 'Редактировать персонажа' : 'Новый персонаж'}</h2>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button type="button" onClick={surpriseCharacter} className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 px-4 py-2 text-xs font-bold text-accent transition-all hover:bg-accent hover:text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                    Удивите меня
                  </button>
                  <button onClick={resetCharacterForm} className="rounded-full p-2 text-text-secondary transition-colors hover:bg-warm-inner hover:text-accent">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-title">Имя *</label>
                  <input type="text" value={charFormData.name} onChange={(event) => setCharFormData((previous) => ({ ...previous, name: event.target.value }))} placeholder="Имя персонажа" className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-title">Роль</label>
                  <input type="text" value={charFormData.role} onChange={(event) => setCharFormData((previous) => ({ ...previous, role: event.target.value }))} placeholder="Друг, питомец, волшебник..." className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white" />
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-1 block text-sm font-bold text-title">Связь с профилем ребёнка</label>
                <select value={charFormData.childProfileId} onChange={(event) => setCharFormData((previous) => ({ ...previous, childProfileId: event.target.value }))} className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white">
                  <option value="">Без привязки</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-bold text-title">Аватар</label>
                <AvatarSelector value={charFormData.presetAvatarId} onChange={(presetAvatarId) => setCharFormData((previous) => ({ ...previous, presetAvatarId }))} />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-bold text-title">Описание</label>
                <textarea value={charFormData.description} onChange={(event) => setCharFormData((previous) => ({ ...previous, description: event.target.value }))} placeholder="Внешность, характер, сказочная особенность" rows={2} className="w-full resize-none rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white" />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-title">Черты характера</label>
                  <input type="text" value={charFormData.traits} onChange={(event) => setCharFormData((previous) => ({ ...previous, traits: event.target.value }))} placeholder="Смелый, добрый, любопытный..." className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-title">Интересы</label>
                  <input type="text" value={charFormData.interests} onChange={(event) => setCharFormData((previous) => ({ ...previous, interests: event.target.value }))} placeholder="Любимые занятия" className="w-full rounded-lg border border-border-light bg-warm-inner/30 px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent focus:bg-white" />
                </div>
              </div>

              <div className="mb-6 border-t border-border-light/60 pt-4">
                <label className="mb-3 flex items-center gap-2 text-sm font-bold text-title">
                  <input
                    type="checkbox"
                    checked={charFormData.voiceEnabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setCharFormData((previous) => ({
                        ...previous,
                        voiceEnabled: enabled,
                        voiceId: enabled ? previous.voiceId || ttsVoices[0]?.voiceId || '' : previous.voiceId,
                      }));
                    }}
                    className="rounded"
                  />
                  Готовый голос персонажа
                </label>
                {charFormData.voiceEnabled && (
                  <>
                    <select value={charFormData.voiceId} onChange={(event) => setCharFormData((previous) => ({ ...previous, voiceId: event.target.value }))} disabled={ttsVoicesLoading || ttsVoices.length === 0} className="w-full rounded-lg border border-border-light bg-white px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-accent disabled:opacity-60">
                      <option value="">{ttsVoicesLoading ? 'Загрузка голосов...' : '— Выберите голос —'}</option>
                      {ttsVoices.map((voice) => (
                        <option key={voice.voiceId} value={voice.voiceId}>{voice.name} — {voice.description}</option>
                      ))}
                    </select>
                    {ttsVoicesError && <p className="mt-2 text-xs text-red-500">{ttsVoicesError}</p>}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={resetCharacterForm} className="rounded-full border border-border-light px-5 py-2.5 text-sm font-semibold text-text-secondary transition-all hover:bg-warm-inner">
                  Отмена
                </button>
                <button onClick={handleSaveCharacter} disabled={charSaving} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-warm-soft transition-all hover:bg-accent-hover disabled:opacity-50">
                  {charSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {charSaving ? 'Сохранение...' : editingChar ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          )}

          {charLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-text-secondary">Загрузка персонажей...</p>
            </div>
          )}

          {!charLoading && characters.length === 0 && !charShowForm && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warm-peach">
                <Users className="h-10 w-10 text-accent" />
              </div>
              <h3 className="mb-2 font-title text-xl font-bold text-title">Пока нет персонажей</h3>
              <p className="mb-6 max-w-md text-center text-sm text-text-secondary">Создайте друга, питомца или волшебного помощника из готовой библиотеки.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={surpriseCharacter} className="flex items-center gap-2 rounded-full border border-accent/30 bg-white px-6 py-3 text-sm font-bold text-accent shadow-warm-soft transition-all hover:bg-accent hover:text-white">
                  <Sparkles className="h-4 w-4" />
                  Удивите меня
                </button>
                <button onClick={() => setCharShowForm(true)} className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-warm-soft transition-all hover:bg-accent-hover">
                  <UserPlus className="h-4 w-4" />
                  Создать персонажа
                </button>
              </div>
            </div>
          )}

          {!charLoading && characters.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => {
                const linkedProfile = profiles.find((profile) => profile.id === character.childProfileId);
                return (
                  <div key={character.id} className="flex flex-col rounded-card border border-border-light bg-white p-5 shadow-warm-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-warm-md">
                    <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-warm-inner">
                      <AvatarImage avatarId={character.presetAvatarId || NO_AVATAR_ID} alt={character.name} />
                    </div>
                    <h3 className="font-title text-lg font-bold text-title">{character.name}</h3>
                    {character.role && <p className="mt-1 text-xs text-text-secondary">Роль: {character.role}</p>}
                    {linkedProfile && <p className="mt-1 text-xs text-text-secondary">Профиль: {linkedProfile.name}</p>}
                    {character.traits && <p className="mt-1 line-clamp-1 text-xs text-text-secondary"><span className="font-semibold">Черты:</span> {character.traits}</p>}
                    {character.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{character.description}</p>}
                    {character.voiceEnabled && <p className="mt-2 inline-flex w-fit rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent">Голос в диалогах</p>}

                    <div className="mt-4 flex items-center gap-2 border-t border-border-light/60 pt-3">
                      <button onClick={() => handleEditCharacter(character)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-all duration-150 hover:bg-accent hover:text-white">
                        <Pencil className="h-3 w-3" />
                        Редактировать
                      </button>
                      <button onClick={() => handleDeleteCharacter(character.id)} disabled={deletingCharId === character.id} className="rounded-full border border-border-light px-3 py-2 text-xs font-bold text-text-secondary transition-all duration-150 hover:border-red-200 hover:text-red-500">
                        {deletingCharId === character.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-16 rounded-panel border border-border-light bg-white p-8 shadow-warm-soft md:p-10">
        <h2 className="mb-8 text-center font-title text-2xl font-bold text-title md:text-3xl">Для семейного сценария</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6 lg:gap-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warm-peach text-accent">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-title">Минимум данных</h3>
            <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-text md:text-sm">Возраст хранится только как группа, а аватары выбираются из готовой библиотеки.</p>
          </div>
          <div className="flex flex-col items-center border-y border-border-soft py-6 text-center md:border-x md:border-y-0 md:py-0">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warm-peach text-accent">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-title">Готовые герои</h3>
            <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-text md:text-sm">Выберите животное или сказочного персонажа, не загружая личные фотографии.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warm-peach text-accent">
              <Heart className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-title">Добрые истории</h3>
            <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-text md:text-sm">Персонажи помогают сделать сказку тёплой, но не требуют лишних персональных данных.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
