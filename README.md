# ТвориСказку

**Персонализированные сказки с озвучкой.**

ТвориСказку помогает родителям за минуты превратить простую идею в готовую сказку:
выбрать возраст, жанр, героя и голос рассказчика — и получить тёплую историю,
которую можно сохранить, послушать, скачать MP3 или подготовить как PDF-книгу.

## Demo Flow

1. Создать аккаунт или войти.
2. Ввести идею сказки.
3. Выбрать возрастную группу, жанр, героя и голос рассказчика.
4. Сгенерировать сказку.
5. Сохранить в библиотеку.
6. Озвучить и скачать MP3.
7. Подготовить PDF-версию.

Весь сценарий работает end-to-end на одном локальном запуске.

## Stack

- **Frontend:** React + Vite
- **Backend:** Fastify + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Cache:** Redis
- **File storage:** MinIO (S3-совместимое)
- **Infrastructure:** Docker Compose
- **Tests:** Vitest
- **AI:** Yandex Cloud AI Studio / DeepSeek
- **TTS:** ElevenLabs через stateless-ретранслятор

## Local Run

```bash
# Установка зависимостей
npm install
npm --prefix backend install
npm --prefix foreign-tts-relay install

# Запуск инфраструктуры (PostgreSQL, Redis, MinIO, Mailpit)
docker compose up -d

# Миграции Prisma
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate

# Запуск backend (порт 3001)
npm --prefix backend run dev

# Запуск frontend (порт 3000)
npm run dev
```

**Сервисы после запуска:**

| Сервис | URL |
|---|---|
| Frontend | http://127.0.0.1:3000 |
| Backend API | http://127.0.0.1:3001 |
| Mailpit (тест email) | http://127.0.0.1:8025 |
| MinIO Console | http://127.0.0.1:9001 |

## Checks

```bash
npm test                # frontend tests (27)
npm run build           # frontend build
npm --prefix backend run test    # backend tests (342)
npm --prefix backend run build   # backend typecheck
```

## Environment

Используйте `.env.example` и `foreign-tts-relay/.env.example` как шаблоны.
Реальные ключи хранятся только в локальных `.env` файлах и не коммитятся.
