import React, { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, AlertCircle, Pencil, Trash2, Check, X, Image, Sparkles } from 'lucide-react';
import { getScenes, createScene, updateScene, deleteScene, getIllustrations, uploadIllustration, deleteIllustration, getIllustrationUrl, getStories, getIllustrationProviderStatus, generateIllustration, getGeneratedIllustrationStatus } from '../api.js';

export default function StoryScenes({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const storyIdParam = params.get('storyId');

  const [stories, setStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState(storyIdParam || '');
  const [scenes, setScenes] = useState([]);
  const [illustrations, setIllustrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [ilUrls, setIlUrls] = useState({});
  const [uploadingIl, setUploadingIl] = useState(false);
  const [providerStatus, setProviderStatus] = useState({ configured: false, message: '' });
  const [generationDescription, setGenerationDescription] = useState('');
  const [generationStyle, setGenerationStyle] = useState('мягкая акварельная иллюстрация для детской книги');
  const [generationSceneId, setGenerationSceneId] = useState('');
  const [generatingIllustrationId, setGeneratingIllustrationId] = useState('');
  const generationPollRef = useRef(null);

  useEffect(() => {
    getStories({ limit: 100 }).then((d) => setStories(d.stories || [])).catch(() => {});
    getIllustrationProviderStatus().then(setProviderStatus).catch(() => {});
    return () => {
      if (generationPollRef.current) clearInterval(generationPollRef.current);
    };
  }, []);

  const fetchData = async () => {
    if (!selectedStoryId) { setScenes([]); setIllustrations([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [sc, il] = await Promise.all([
        getScenes(selectedStoryId),
        getIllustrations(selectedStoryId),
      ]);
      setScenes(sc || []);
      setIllustrations(il || []);
      const urls = {};
      for (const i of (il || [])) {
        if (i.objectName) { try { const r = await getIllustrationUrl(i.id); urls[i.id] = r.url; } catch {} }
      }
      setIlUrls(urls);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedStoryId]);

  const handleCreateScene = async () => {
    if (!selectedStoryId || !newTitle.trim()) return;
    try {
      await createScene({ storyId: selectedStoryId, title: newTitle.trim() });
      setNewTitle('');
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleSaveEdit = async (id) => {
    try { await updateScene(id, { title: editTitle, description: editDesc }); setEditingId(null); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  const handleDeleteScene = async (id) => {
    if (!window.confirm('Удалить сцену?')) return;
    try { await deleteScene(id); await fetchData(); } catch (err) { setError(err.message); }
  };

  const handleUploadIll = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStoryId) return;
    setUploadingIl(true);
    try {
      await uploadIllustration(selectedStoryId, file);
      e.target.value = '';
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setUploadingIl(false); }
  };

  const handleDeleteIll = async (id) => {
    if (!window.confirm('Удалить иллюстрацию?')) return;
    try { await deleteIllustration(id); await fetchData(); } catch (err) { setError(err.message); }
  };

  const handleGenerateIllustration = async () => {
    if (!selectedStoryId || !providerStatus.configured || generationDescription.trim().length < 10) return;
    setError('');
    try {
      const illustration = await generateIllustration({
        storyId: selectedStoryId,
        sceneId: generationSceneId || undefined,
        description: generationDescription.trim(),
        style: generationStyle,
      });
      setGeneratingIllustrationId(illustration.id);
      if (generationPollRef.current) clearInterval(generationPollRef.current);
      let attempts = 0;
      generationPollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const current = await getGeneratedIllustrationStatus(illustration.id);
          if (current.status === 'generated' || current.status === 'uploaded') {
            clearInterval(generationPollRef.current);
            generationPollRef.current = null;
            setGeneratingIllustrationId('');
            setGenerationDescription('');
            await fetchData();
          } else if (current.status === 'failed') {
            clearInterval(generationPollRef.current);
            generationPollRef.current = null;
            setGeneratingIllustrationId('');
            setError(current.error || 'Не удалось создать иллюстрацию');
          } else if (attempts >= 75) {
            clearInterval(generationPollRef.current);
            generationPollRef.current = null;
            setGeneratingIllustrationId('');
            setError('Иллюстрация создаётся дольше обычного. Обновите страницу через несколько минут.');
          }
        } catch (err) {
          clearInterval(generationPollRef.current);
          generationPollRef.current = null;
          setGeneratingIllustrationId('');
          setError(err.message || 'Не удалось проверить иллюстрацию');
        }
      }, 4000);
    } catch (err) {
      setGeneratingIllustrationId('');
      setError(err.message || 'Не удалось запустить генерацию иллюстрации');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-12">
        <div className="lg:col-span-5">
          <span className="text-xs font-bold text-accent uppercase tracking-wider">Сцены и иллюстрации</span>
          <h1 className="font-title text-3xl md:text-4xl font-bold text-title mt-2">Работа со сказкой</h1>
        </div>
        <div className="lg:col-span-7">
          <select value={selectedStoryId} onChange={(e) => setSelectedStoryId(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-border-light rounded-xl text-sm outline-none focus:border-accent">
            <option value="">Выберите сказку</option>
            {stories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-inner flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</div>}

      {!selectedStoryId && <p className="text-text-secondary text-center py-16">Выберите сказку для управления сценами и иллюстрациями.</p>}

      {selectedStoryId && loading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>}

      {selectedStoryId && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scenes column */}
          <div className="bg-white border border-border-light rounded-panel p-6 shadow-warm-soft">
            <h2 className="font-bold text-title text-lg mb-4">Сцены ({scenes.length})</h2>
            <div className="flex gap-2 mb-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Название сцены" className="flex-1 px-3 py-2 border border-border-light rounded-lg text-sm focus:border-accent outline-none" />
              <button onClick={handleCreateScene} disabled={!newTitle.trim()} className="px-4 py-2 rounded-full bg-accent text-white text-sm font-semibold disabled:opacity-50"><Plus className="w-4 h-4" /></button>
            </div>
            {scenes.length === 0 && <p className="text-sm text-text-secondary">Сцен пока нет.</p>}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {scenes.map((s, idx) => (
                <div key={s.id} className="border border-border-light rounded-xl p-3">
                  {editingId === s.id ? (
                    <div className="space-y-2">
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-1.5 border border-border-light rounded-lg text-sm" />
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Описание" className="w-full px-3 py-1.5 border border-border-light rounded-lg text-sm" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(s.id)} className="text-green-600"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="text-text-secondary"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-text-secondary mr-2">#{idx + 1}</span>
                        <span className="font-semibold text-sm">{s.title || 'Без названия'}</span>
                        {s.description && <p className="text-xs text-text-secondary mt-0.5 truncate">{s.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingId(s.id); setEditTitle(s.title); setEditDesc(s.description); }} className="p-1.5 rounded-full hover:bg-warm-inner text-text-secondary"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteScene(s.id)} className="p-1.5 rounded-full hover:bg-red-50 text-text-secondary hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Illustrations column */}
          <div className="bg-white border border-border-light rounded-panel p-6 shadow-warm-soft">
            <h2 className="font-bold text-title text-lg mb-4">Иллюстрации ({illustrations.length})</h2>
            <div className="rounded-xl border border-border-light bg-warm-inner/30 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="font-bold text-title text-sm">Создать иллюстрацию</h3>
              </div>
              {providerStatus.configured ? (
                <div className="space-y-3">
                  <textarea
                    value={generationDescription}
                    onChange={(event) => setGenerationDescription(event.target.value.slice(0, 1800))}
                    placeholder="Опишите сцену: кто изображён, где находятся герои и что происходит"
                    className="w-full min-h-[88px] px-3 py-2.5 bg-white border border-border-light rounded-lg text-sm outline-none focus:border-accent resize-y"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select value={generationSceneId} onChange={(event) => setGenerationSceneId(event.target.value)} className="px-3 py-2.5 bg-white border border-border-light rounded-lg text-xs outline-none focus:border-accent">
                      <option value="">Без привязки к сцене</option>
                      {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title || `Сцена ${scene.position}`}</option>)}
                    </select>
                    <select value={generationStyle} onChange={(event) => setGenerationStyle(event.target.value)} className="px-3 py-2.5 bg-white border border-border-light rounded-lg text-xs outline-none focus:border-accent">
                      <option value="мягкая акварельная иллюстрация для детской книги">Мягкая акварель</option>
                      <option value="уютная книжная гуашь с мягким светом">Книжная гуашь</option>
                      <option value="сказочная цветная карандашная иллюстрация">Цветные карандаши</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateIllustration}
                    disabled={Boolean(generatingIllustrationId) || generationDescription.trim().length < 10}
                    className="px-4 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                  >
                    {generatingIllustrationId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingIllustrationId ? 'Создаём иллюстрацию…' : 'Создать иллюстрацию'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-secondary">Генерация изображений пока не подключена. Сейчас можно загрузить готовую иллюстрацию вручную.</p>
              )}
            </div>
            <p className="text-xs text-text-secondary mb-3">Или загрузите готовую иллюстрацию вручную.</p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold cursor-pointer transition-all">
              {uploadingIl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploadingIl ? 'Загрузка...' : 'Загрузить'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadIll} className="hidden" />
            </label>
            {illustrations.length === 0 && <p className="text-sm text-text-secondary mt-6">Нет иллюстраций.</p>}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {illustrations.map((il) => (
                <div key={il.id} className="relative border border-border-light rounded-xl overflow-hidden group aspect-[4/3] bg-warm-inner">
                  {ilUrls[il.id] ? (
                    <img src={ilUrls[il.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-accent/40"><Image className="w-10 h-10" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button onClick={() => handleDeleteIll(il.id)} className="p-2 rounded-full bg-white/90 text-red-500 hover:bg-white"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
