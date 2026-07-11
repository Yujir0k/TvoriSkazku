import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Clock, Search, Loader2, AlertCircle, Pencil, Trash2, Plus, BookMarked, ChevronLeft, ChevronRight, FileText, ChevronDown } from 'lucide-react';
import { getStories, getBooks, deleteStory, createStory } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import StoryPdfButton from '../components/StoryPdfButton.jsx';
import { getStoryCover } from '../lib/story-covers.js';

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'published', label: 'Готово' },
  { value: 'draft', label: 'Черновик' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt-desc', label: 'Сначала новые' },
  { value: 'updatedAt-asc', label: 'Сначала старые' },
  { value: 'createdAt-desc', label: 'Созданы недавно' },
  { value: 'createdAt-asc', label: 'Созданы давно' },
];

function LibraryDropdown({ label, options, value, isOpen, onToggle, onSelect, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-12 w-full rounded-full border bg-white px-5 text-sm font-semibold transition-all duration-150 shadow-[0_10px_28px_rgba(96,62,38,0.06)] ${
          isOpen
            ? 'border-accent text-accent ring-4 ring-accent/10'
            : 'border-border-light text-text hover:border-accent/50 hover:text-accent'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="block w-full whitespace-nowrap pl-2 pr-7 text-center">{label}</span>
        <ChevronDown
          className={`absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-40 mt-2 w-full min-w-full overflow-hidden rounded-2xl border border-border-light bg-white p-2 shadow-warm-lg"
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => onSelect(option.value)}
                className={`w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all ${
                  selected
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text hover:bg-warm-inner hover:text-accent'
                }`}
                role="option"
                aria-selected={selected}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TalesLibrary({ navigate }) {
  const { user } = useAuth();
  const controlsRef = useRef(null);
  const [stories, setStories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('updatedAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [storyToDelete, setStoryToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [booksByStory, setBooksByStory] = useState({});
  const [openMenu, setOpenMenu] = useState(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Все статусы';
  const sortValue = `${sort}-${order}`;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortValue)?.label || 'Сначала новые';

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { sort, order, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const data = await getStories(params);
      setStories(data.stories);
      setTotal(data.total);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить сказки');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, order, page]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  useEffect(() => {
    let cancelled = false;
    getBooks()
      .then((books) => {
        if (cancelled) return;
        setBooksByStory(Object.fromEntries(books.map((book) => [book.storyId, book])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, sort, order]);

  useEffect(() => {
    if (!openMenu) return undefined;

    const handlePointerDown = (event) => {
      if (!controlsRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!storyToDelete) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !deletingId) {
        setStoryToDelete(null);
        setDeleteError('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deletingId, storyToDelete]);

  const handleCreateDraft = async () => {
    setDeleteError('');
    try {
      const story = await createStory({
        title: 'Новый черновик',
        content: '',
        status: 'draft',
      });
      navigate(`/story-editor?id=${story.id}`);
    } catch (err) {
      setDeleteError(err.message || 'Не удалось создать черновик');
    }
  };

  const handleSortSelect = (value) => {
    const [newSort, newOrder] = value.split('-');
    setSort(newSort);
    setOrder(newOrder);
    setOpenMenu(null);
  };

  const requestDelete = (story) => {
    setDeleteError('');
    setStoryToDelete(story);
  };

  const closeDeleteDialog = () => {
    if (deletingId) return;
    setStoryToDelete(null);
    setDeleteError('');
  };

  const handleDeleteConfirmed = async () => {
    if (!storyToDelete) return;
    setDeleteError('');
    setDeletingId(storyToDelete.id);
    try {
      await deleteStory(storyToDelete.id);
      setStories((prev) => prev.filter((s) => s.id !== storyToDelete.id));
      setTotal((prev) => prev - 1);
      setStoryToDelete(null);
    } catch (err) {
      setDeleteError(err.message || 'Не удалось удалить сказку');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 py-12 md:py-16">
      
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center mb-12">
        <div className="lg:col-span-5 flex flex-col">
          <span className="text-xs md:text-sm font-bold text-accent uppercase tracking-wider">Библиотека</span>
          <h1 className="font-title text-3xl md:text-4xl lg:text-5xl font-bold text-title mt-2 leading-tight">
            Мои сказки
          </h1>
          <p className="text-sm md:text-base text-text mt-4 leading-relaxed">
            Все сохранённые и созданные вами сказки в одном месте. Редактируйте, ищите и управляйте своей коллекцией.
          </p>
        </div>

        <div className="lg:col-span-7 bg-white border border-border-light rounded-panel p-6 md:p-8 shadow-warm-soft">
          <div className="flex flex-col gap-4">
            <div className="w-full p-4 bg-warm-inner/40 border border-border-light/60 rounded-full flex items-center justify-between px-6">
              <span className="font-bold text-title text-sm md:text-base">
                {total > 0 ? `${total} ${total === 1 ? 'сказка' : total < 5 ? 'сказки' : 'сказок'}` : 'Нет сказок'}
              </span>
              <BookMarked className="w-4 h-4 text-accent" />
            </div>
          </div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="mb-6 flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
        <div ref={controlsRef} className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(280px,380px)_220px_240px] xl:flex xl:flex-wrap xl:items-center">
          {/* Поиск */}
          <div className="relative min-w-0 xl:min-w-[300px] xl:max-w-[380px] xl:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border-light rounded-full text-sm text-text outline-none focus:border-accent transition-colors"
            />
          </div>

          <LibraryDropdown
            label={statusLabel}
            options={STATUS_OPTIONS}
            value={statusFilter}
            isOpen={openMenu === 'status'}
            onToggle={() => setOpenMenu((current) => (current === 'status' ? null : 'status'))}
            onSelect={(value) => {
              setStatusFilter(value);
              setOpenMenu(null);
            }}
            className="min-w-[220px]"
          />

          <LibraryDropdown
            label={sortLabel}
            options={SORT_OPTIONS}
            value={sortValue}
            isOpen={openMenu === 'sort'}
            onToggle={() => setOpenMenu((current) => (current === 'sort' ? null : 'sort'))}
            onSelect={handleSortSelect}
            className="min-w-[240px]"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:shrink-0">
          <button
            onClick={handleCreateDraft}
            className="min-w-[190px] px-5 py-2.5 rounded-full border border-dashed border-accent text-accent hover:bg-accent hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="text-center">Новый черновик</span>
          </button>
          <button
            onClick={() => navigate('/story-creator')}
            className="min-w-[190px] px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm flex items-center justify-center gap-2 shadow-warm-soft transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="text-center">Создать сказку</span>
          </button>
        </div>
      </div>

      {/* Ошибка удаления */}
      {deleteError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-inner flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {deleteError}
        </div>
      )}

      {/* Состояние загрузки */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
          <p className="text-text-secondary text-sm">Загрузка сказок...</p>
        </div>
      )}

      {/* Ошибка загрузки */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-panel p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-title text-sm">Ошибка загрузки</p>
            <p className="text-sm text-text-secondary mt-1">{error}</p>
            <button
              onClick={fetchStories}
              className="mt-3 text-sm font-semibold text-accent hover:text-accent-hover"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      )}

      {/* Пустая библиотека */}
      {!loading && !error && !deleteError && stories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-warm-peach rounded-full flex items-center justify-center mb-6">
            <BookOpen className="w-10 h-10 text-accent" />
          </div>
          <h3 className="font-title text-xl font-bold text-title mb-2">
            {search || statusFilter ? 'Ничего не найдено' : 'Библиотека пуста'}
          </h3>
          <p className="text-text-secondary text-sm mb-6 text-center max-w-md">
            {search || statusFilter
              ? 'Попробуйте изменить параметры поиска или фильтр'
              : 'Создайте первую сказку, и она появится здесь'
            }
          </p>
          {!search && !statusFilter && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateDraft}
                className="px-6 py-3 rounded-full border border-dashed border-accent text-accent hover:bg-accent hover:text-white font-bold text-sm flex items-center gap-2 transition-all"
              >
                <FileText className="w-4 h-4" />
                Новый черновик
              </button>
              <button
                onClick={() => navigate('/story-creator')}
                className="px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-sm flex items-center gap-2 shadow-warm-soft transition-all"
              >
                <Plus className="w-4 h-4" />
                Создать сказку
              </button>
            </div>
          )}
        </div>
      )}

      {/* Список сказок */}
      {!loading && !error && stories.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {stories.map((story) => (
              <div
                key={story.id}
                className="group bg-white border border-border-light rounded-card p-5 flex flex-col justify-between shadow-warm-soft hover:shadow-warm-md hover:-translate-y-1 transition-all duration-300"
              >
                <div>
                  <div className="w-full aspect-[4/3] bg-warm-inner rounded-xl overflow-hidden mb-4 relative">
                    <img
                      src={getStoryCover(story).src}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-title/25 to-transparent pointer-events-none" />
                    <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      story.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {story.status === 'published' ? 'Готово' : 'Черновик'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      {formatDate(story.updatedAt)}
                    </span>
                  </div>

                  <h3 className="font-title text-lg font-bold text-title leading-snug min-h-[52px] line-clamp-2">
                    {story.title}
                  </h3>

                  {story.content && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                      {story.content.replace(/^#+\s.*$/gm, '').replace(/\*\*/g, '').trim().slice(0, 120)}
                      {story.content.length > 120 ? '...' : ''}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border-light/60 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/story-editor?id=${story.id}`)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Открыть
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {story.content ? (
                      <StoryPdfButton
                        storyId={story.id}
                        title={story.title}
                        existingBook={booksByStory[story.id] || null}
                        lookupExisting={false}
                        compact
                        onReady={(book) => setBooksByStory((current) => ({ ...current, [story.id]: book }))}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => requestDelete(story)}
                      disabled={deletingId === story.id}
                      title="Удалить сказку"
                      aria-label={`Удалить сказку «${story.title}»`}
                      className="w-10 h-10 rounded-full border border-border-light text-text-secondary hover:text-red-500 hover:border-red-200 hover:bg-red-50 text-xs font-bold transition-all duration-150 inline-flex items-center justify-center disabled:opacity-50"
                    >
                      {deletingId === story.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded-full border border-border-light text-text-secondary hover:text-accent hover:border-accent text-sm font-semibold flex items-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
              <span className="text-sm text-text-secondary">
                {page + 1} из {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 rounded-full border border-border-light text-text-secondary hover:text-accent hover:border-accent text-sm font-semibold flex items-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Вперёд
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {storyToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-title/35 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-story-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteDialog();
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-panel bg-white border border-border-light shadow-warm-lg animate-[fadeIn_160ms_ease-out]">
            <div className="p-6 md:p-7">
              <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-5">
                <Trash2 className="w-6 h-6" />
              </div>

              <p className="text-xs md:text-sm font-bold text-accent uppercase tracking-wider mb-2">
                Удаление сказки
              </p>
              <h2 id="delete-story-title" className="font-title text-2xl md:text-3xl font-bold text-title leading-tight">
                Удалить эту сказку?
              </h2>
              <p className="mt-3 text-sm md:text-base text-text-secondary leading-relaxed">
                «{storyToDelete.title || 'Без названия'}» исчезнет из библиотеки. Это действие нельзя будет отменить.
              </p>

              {deleteError && (
                <div className="mt-5 px-4 py-3 bg-red-50 border border-red-200 rounded-inner flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {deleteError}
                </div>
              )}

              <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  disabled={Boolean(deletingId)}
                  className="px-5 py-3 rounded-full bg-warm-inner text-text hover:bg-warm-peach font-bold text-sm transition-all disabled:opacity-50"
                >
                  Оставить сказку
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirmed}
                  disabled={Boolean(deletingId)}
                  className="px-5 py-3 rounded-full bg-red-500 text-white hover:bg-red-600 font-bold text-sm transition-all shadow-warm-soft flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
