import React, { useState, useEffect } from 'react';
import { Printer, ArrowRight, Loader2, AlertCircle, Check, BookOpen, Download, Plus, Trash2 } from 'lucide-react';
import { getStories, getBooks, createBook, generateBookPdf, getBookPdfDownloadUrl, deleteBook } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

function withFastFallback(promise, fallback, onFallback) {
  let settled = false;

  return Promise.race([
    promise.then((value) => {
      settled = true;
      return value;
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        if (!settled) {
          onFallback?.();
          resolve(fallback);
        }
      }, 1200);
    }),
  ]).catch(() => {
    onFallback?.();
    return fallback;
  });
}

export default function BookCreationPrinting({ navigate }) {
  const { user, loading: authLoading } = useAuth();
  const [stories, setStories] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [format, setFormat] = useState('a4');
  const [creating, setCreating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);

  const fetchData = async () => {
    if (authLoading) return;

    if (!user) {
      setStories([]);
      setBooks([]);
      setError('');
      setGuestMode(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setGuestMode(false);
    let usedFallback = false;
    const markFallback = () => { usedFallback = true; };

    const [s, b] = await Promise.all([
      withFastFallback(getStories({ limit: 100 }), { stories: [] }, markFallback),
      withFastFallback(getBooks(), [], markFallback),
    ]);

    setStories(s.stories || []);
    setBooks(b || []);
    setGuestMode(usedFallback);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [authLoading, user]);

  const handleCreateBook = async () => {
    if (!selectedStoryId || !bookTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createBook({ storyId: selectedStoryId, title: bookTitle.trim(), authorName: authorName.trim(), format });
      setBookTitle('');
      setAuthorName('');
      setSelectedStoryId('');
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  const handleGeneratePdf = async (id) => {
    setGeneratingId(id);
    setError('');
    try {
      await generateBookPdf(id);
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setGeneratingId(null); }
  };

  const handleDeleteBook = async (id) => {
    if (!window.confirm('Удалить проект книги?')) return;
    try { await deleteBook(id); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  const handleDownloadPdf = async (book) => {
    setError('');
    try {
      const anchor = document.createElement('a');
      anchor.href = getBookPdfDownloadUrl(book.id);
      anchor.download = `${String(book.title || 'Сказка').replace(/[<>:"/\\|?*]/g, '_')}.pdf`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      setError(err.message || 'Не удалось скачать PDF');
    }
  };

  const steps = [
    { num: 1, title: 'Создать проект', desc: 'Выберите сказку, укажите название и автора.' },
    { num: 2, title: 'Настроить', desc: 'Выберите формат A4 или A5.' },
    { num: 3, title: 'Сгенерировать PDF', desc: 'Сервер соберёт PDF с текстом и нумерацией страниц.' },
    { num: 4, title: 'Скачать', desc: 'Получите готовый PDF через временную ссылку.' }
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
      
      {/* Desktop Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center mb-16">
        
        {/* Левая колонка: Текст */}
        <div className="lg:col-span-5 flex flex-col">
          <span className="text-xs md:text-sm font-bold text-accent uppercase tracking-wider">PDF-книги</span>
          <h1 className="font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title mt-2 leading-tight">
            PDF своими руками
          </h1>
          <p className="text-sm md:text-base text-text mt-4 leading-relaxed">
            Создайте PDF из любой сохранённой сказки. Распечатайте сами. Печать и доставка появятся позже.
          </p>
        </div>

        {/* Правая колонка: Четыре вертикальные строки */}
        <div className="lg:col-span-7 bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-soft">
          <div className="flex flex-col gap-5">
            {steps.map((step) => (
              <div key={step.num} className="flex items-start gap-4 p-3 rounded-xl hover:bg-warm-inner/30 transition-colors duration-150">
                <div className="w-10 h-10 rounded-full bg-accent text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-bold text-title text-base">{step.title}</h3>
                  <p className="text-xs md:text-sm text-text-secondary mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {error && !guestMode && <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-inner flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</div>}

      {guestMode && (
        <div className="mb-6 px-5 py-4 bg-white border border-border-light rounded-inner flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-text shadow-warm-soft">
          <div>
            <p className="font-bold text-title">PDF-книги доступны после входа</p>
            <p className="text-text-secondary mt-1">Сначала сохраните сказку в библиотеку, затем здесь можно будет собрать красивый PDF.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate?.('/sign-in')}
              className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-all"
            >
              Войти
            </button>
            <button
              type="button"
              onClick={() => navigate?.('/story-creator')}
              className="px-5 py-2.5 rounded-full border border-border-light text-title text-sm font-bold hover:border-accent hover:text-accent transition-all"
            >
              Создать сказку
            </button>
          </div>
        </div>
      )}

      {/* Создание проекта */}
      <div className="bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-soft mb-8">
        <h2 className="font-bold text-title text-lg mb-4">Создать PDF-проект</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Сказка</label>
            <select value={selectedStoryId} onChange={(e) => { const s = stories.find(x => x.id === e.target.value); setSelectedStoryId(e.target.value); if (s && !bookTitle) setBookTitle(s.title); }} className="w-full px-3 py-2.5 bg-white border border-border-light rounded-lg text-sm outline-none focus:border-accent">
              <option value="">Выберите сказку</option>
              {stories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary mb-1">Формат</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-border-light rounded-lg text-sm outline-none focus:border-accent">
              <option value="a4">A4</option>
              <option value="a5">A5</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Название книги" className="px-3 py-2.5 border border-border-light rounded-lg text-sm outline-none focus:border-accent" />
          <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Автор (имя ребёнка)" className="px-3 py-2.5 border border-border-light rounded-lg text-sm outline-none focus:border-accent" />
        </div>
        <button onClick={handleCreateBook} disabled={guestMode || creating || !selectedStoryId || !bookTitle.trim()} className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? 'Создание...' : 'Создать проект'}
        </button>
      </div>

      {/* Проекты */}
      <div className="bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-soft">
        <h2 className="font-bold text-title text-lg mb-4">Мои PDF-проекты ({books.length})</h2>
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>}
        {!loading && books.length === 0 && (
          <p className="text-sm text-text-secondary">
            {guestMode ? 'После входа здесь появятся ваши PDF-проекты.' : 'Нет проектов. Создайте первый выше.'}
          </p>
        )}
        {!loading && books.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.map((bk) => (
              <div key={bk.id} className="border border-border-light rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-title text-sm">{bk.title}</h3>
                    {bk.authorName && <p className="text-xs text-text-secondary">{bk.authorName}</p>}
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-text-secondary">
                      <span>{bk.format?.toUpperCase()}</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${bk.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{bk.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {bk.status !== 'ready' ? (
                    <button onClick={() => handleGeneratePdf(bk.id)} disabled={generatingId === bk.id} className="px-3 py-1.5 rounded-full bg-accent text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1">
                      {generatingId === bk.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {generatingId === bk.id ? 'Генерация...' : 'Сгенерировать PDF'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleDownloadPdf(bk)} className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1 hover:bg-green-200 transition-all">
                      <Download className="w-3 h-3" />
                      Скачать PDF
                    </button>
                  )}
                  <button onClick={() => handleGeneratePdf(bk.id)} disabled={generatingId === bk.id} className="px-3 py-1.5 rounded-full border border-border-light text-xs font-semibold text-text-secondary hover:bg-warm-inner disabled:opacity-50">
                    Перегенерировать
                  </button>
                  <button onClick={() => handleDeleteBook(bk.id)} className="px-3 py-1.5 rounded-full border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
