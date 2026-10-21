# Бюро стартапов

Многостраничный русскоязычный сайт с профилями Стартапера и Инвестора, проектами, рейтингом, формой создания стартапа и ИИ-поддержкой.

## Запуск сайта и API

Откройте PowerShell в этой папке, задайте ключ inference-сервиса и запустите локальный сервер:

```powershell
$env:INFERENCE_API_KEY="ваш API-ключ"
$env:INFERENCE_BASE_URL="https://inference.dahl.global/v1"
$env:INFERENCE_MODEL="zai-org/GLM-5.3-Flash"
node server.js
```

Затем открывайте сайт по адресу http://localhost:4173 (не через file://). Ключ остаётся в переменной окружения сервера и не отправляется в браузер. /api/health показывает конфигурацию; /api/evaluate анализирует стартап; /api/support отвечает на вопросы; /api/register и /api/login создают и находят аккаунты. Пользовательский профиль доступен по /profile.html после регистрации/входа.

Сервер использует встроенные модули Node.js, отдельная установка npm-пакетов не нужна. Аккаунты сохраняются в data.json, пароли защищены scrypt-хешем. Перед публичным развертыванием следует добавить надёжные сессии и CSRF-защиту, ограничение частоты запросов, модерацию голосов и резервное копирование.

## Оценка проекта

Предлагаемая модель: 50% оценка ИИ, 25% наставник, 25% сообщество. ИИ оценивает описание по шкале 0–100 и поясняет сильные стороны и следующий шаг. Голоса сообщества сейчас сохраняются браузером; API поддерживает сохранение голосов и требует подключить аутентифицированный пользовательский интерфейс.

Страницы: `index.html`, `projects.html`, `leaderboard.html`, `method.html`, `create.html`, `register.html`, `login.html`, `profile.html`.

## Netlify

Repository settings in Netlify: **Add new site → Import an existing project → GitHub → TREASURE1HUNT/buro-startapov**. Build command can stay empty; publish directory is `.` from `netlify.toml`. Add environment variables `INFERENCE_BASE_URL=https://inference.dahl.global/v1`, `INFERENCE_MODEL=zai-org/GLM-5.3-Flash`, and `INFERENCE_API_KEY` in the Netlify dashboard, then deploy. Never put the actual key in Git or frontend code. The Netlify functions power AI analysis and chat. The local Node API also supports registration/login; persistent accounts on Netlify need an external database/auth provider, while the current browser-only demo profile is not synchronized across devices.
# Хранилище сайта — Render Postgres

Render Postgres и отдельный API-сервис описаны в `render.yaml`. Схема находится в `netlify/database/migrations/0001_core/migration.sql`; `render-server.mjs` применяет её при первом запуске API. API хранит аккаунты и сессии, проекты с медиа, голоса сообщества и пользовательские записи (настройки, черновики, избранное, оценки и историю поддержки). `DATABASE_URL` берётся из внутреннего соединения Render и остаётся только на сервере. Netlify проксирует `/api/database` на Render, остальные статические страницы и AI-функции продолжают обслуживаться Netlify.

Для запуска подключите GitHub-репозиторий в Render как Blueprint и примените `render.yaml`. Blueprint сейчас создаёт бесплатную базу для первичного развёртывания. По документации Render бесплатная Postgres-база истекает через 30 дней; для постоянного production-хранения до этого срока переведите её на платный план. Netlify-прокси настроен на `https://buro-startapov-api.onrender.com/api/database`.

Существующие браузерные аккаунты, проекты и пользовательские записи синхронизируются через предусмотренный перенос после входа. При первом обращении к рейтингу API импортирует агрегированные голоса из прежнего Netlify-хранилища в Render Postgres; индивидуальная привязка старых голосов к аккаунтам не переносится.
