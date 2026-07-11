import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

import { requireAuth } from '../auth/auth.middleware.js';
import { storage } from '../../lib/storage.js';
import { getBooks, getBookById, createBook, updateBook, deleteBook, generatePdf, getBookPdfUrl } from './books.service.js';
import { createBookSchema, updateBookSchema, bookIdParamSchema } from './books.schema.js';

const booksRoutes: FastifyPluginCallback = (app, _options, done) => {
  // GET /api/books
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const books = await getBooks(request.auth!.user.id);
    return reply.send(books);
  });

  // GET /api/books/:id
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = bookIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const book = await getBookById(parsed.data.id, request.auth!.user.id);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Проект книги не найден' });
    return reply.send(book);
  });

  // POST /api/books
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = createBookSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0]?.message });
    const book = await createBook(request.auth!.user.id, parsed.data);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Сказка не найдена' });
    return reply.code(201).send(book);
  });

  // PATCH /api/books/:id
  app.patch('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsedParams = bookIdParamSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const parsedBody = updateBookSchema.safeParse(request.body);
    if (!parsedBody.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: parsedBody.error.issues[0]?.message });
    const book = await updateBook(parsedParams.data.id, request.auth!.user.id, parsedBody.data);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Проект книги не найден' });
    return reply.send(book);
  });

  // POST /api/books/:id/generate
  app.post('/:id/generate', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = bookIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const book = await generatePdf(parsed.data.id, request.auth!.user.id);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Проект книги не найден' });
    return reply.send(book);
  });

  // GET /api/books/:id/pdf-url
  app.get('/:id/pdf-url', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = bookIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const url = await getBookPdfUrl(parsed.data.id, request.auth!.user.id);
    if (!url) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'PDF ещё не сгенерирован' });
    return reply.send({ url });
  });

  // GET /api/books/:id/download — стабильное авторизованное скачивание без перехода на MinIO.
  app.get('/:id/download', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = bookIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const book = await getBookById(parsed.data.id, request.auth!.user.id);
    if (!book) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Проект книги не найден' });
    if (book.status !== 'ready' || !book.pdfObjectName) {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'PDF ещё не сгенерирован' });
    }

    try {
      const file = await storage.getObject(book.pdfObjectName);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Length', String(file.size))
        .header('Content-Disposition', `attachment; filename="skazka-${book.storyId}.pdf"`)
        .header('Cache-Control', 'private, no-store')
        .send(file.stream);
    } catch {
      return reply.code(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Не удалось получить PDF из хранилища. Попробуйте ещё раз.',
      });
    }
  });

  // DELETE /api/books/:id
  app.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = bookIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Некорректный идентификатор' });
    const deleted = await deleteBook(parsed.data.id, request.auth!.user.id);
    if (!deleted) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Проект книги не найден' });
    return reply.code(204).send();
  });

  done();
};

export function registerBooksRoutes(app: FastifyInstance): void {
  app.register(booksRoutes, { prefix: '/api/books' });
}
