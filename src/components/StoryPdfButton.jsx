import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react';

import { createBook, generateBookPdf, getBookPdfDownloadUrl, getBooks } from '../api.js';

function safePdfName(title) {
  const clean = String(title || 'Сказка')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'Сказка';
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

export default function StoryPdfButton({ storyId, title, existingBook = null, lookupExisting = true, compact = false, onReady }) {
  const [book, setBook] = useState(existingBook);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBook(existingBook);
  }, [existingBook]);

  useEffect(() => {
    if (!lookupExisting || existingBook || !storyId) return;
    let cancelled = false;
    getBooks()
      .then((books) => {
        if (!cancelled) setBook(books.find((item) => item.storyId === storyId) || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [existingBook, lookupExisting, storyId]);

  const download = async (bookId) => {
    const anchor = document.createElement('a');
    anchor.href = getBookPdfDownloadUrl(bookId);
    anchor.download = safePdfName(title);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handlePdf = async (event) => {
    event?.stopPropagation?.();
    if (!storyId || busy) return;
    setBusy(true);
    setError('');
    try {
      let current = book;
      if (!current) {
        const books = await getBooks();
        current = books.find((item) => item.storyId === storyId) || null;
      }
      if (!current) {
        current = await createBook({
          storyId,
          title: title || 'Сказочная книга',
          authorName: '',
          format: 'a4',
        });
      }
      if (current.status !== 'ready' || !current.pdfObjectName) {
        current = await generateBookPdf(current.id);
      }
      setBook(current);
      onReady?.(current);
      await download(current.id);
    } catch (err) {
      setError(err.message || 'Не удалось подготовить PDF');
    } finally {
      setBusy(false);
    }
  };

  const ready = book?.status === 'ready' && book?.pdfObjectName;
  const actionTitle = ready ? 'PDF готов — скачать' : 'PDF ещё не создан — создать и скачать';

  return (
    <span className="inline-flex flex-col items-start gap-1 min-w-0">
      <button
        type="button"
        onClick={handlePdf}
        disabled={busy || !storyId}
        title={actionTitle}
        className={`${compact ? 'w-10 h-10 p-0 text-xs shrink-0' : 'px-3 py-1.5 text-xs'} rounded-full font-semibold border transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 bg-accent/10 border-accent/20 text-accent hover:bg-accent hover:text-white hover:-translate-y-0.5`}
        aria-label={ready ? `Скачать PDF сказки «${title}»` : `Создать PDF сказки «${title}»`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
        <span className={compact ? 'sr-only' : ''}>{busy ? 'Готовим PDF…' : ready ? 'Скачать PDF' : 'Создать PDF'}</span>
      </button>
      {error ? (
        <span className="text-[10px] text-red-600 flex items-center gap-1 max-w-[220px]" role="alert">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </span>
      ) : null}
    </span>
  );
}
