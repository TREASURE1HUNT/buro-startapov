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

Текущая формула: 25% ИИ, 25% наставник и 50% сообщество. Сам балл ИИ рассчитывается по шкале 0–100 из шести взвешенных критериев: проблема (20%), подтверждения спроса (20%), аудитория (15%), решение (15%), экономика (15%) и соответствие стадии/качество доказательств (15%). Результат показывает основания оценки, пробелы в доказательствах, риски и проверяемые следующие шаги; неподтверждённые сведения модель не дополняет выдуманными фактами.

Страницы: `index.html`, `projects.html`, `leaderboard.html`, `method.html`, `create.html`, `register.html`, `login.html`, `profile.html`.

## Netlify

Repository settings in Netlify: **Add new site → Import an existing project → GitHub → TREASURE1HUNT/buro-startapov**. Build command can stay empty; publish directory is `.` from `netlify.toml`. Add environment variables `INFERENCE_BASE_URL=https://inference.dahl.global/v1`, `INFERENCE_MODEL=zai-org/GLM-5.3-Flash`, and `INFERENCE_API_KEY` in the Netlify dashboard, then deploy. Never put the actual key in Git or frontend code. The Netlify functions power AI analysis and chat. The local Node API also supports registration/login; persistent accounts on Netlify need an external database/auth provider, while the current browser-only demo profile is not synchronized across devices.
# Хранилище сайта — Render Postgres

Render Postgres и Web Service описаны в `render.yaml`. `render-server.mjs` применяет версии миграций при старте. Postgres хранит аккаунты/сессии, проекты с медиа, голоса, пользовательские записи, аналитику и импортированные карточки стартапов. `DATABASE_URL` берётся из внутреннего соединения Render и остаётся только на сервере.

Рабочая версия сайта: `https://buro-startapov-api.onrender.com/`. Blueprint создаёт бесплатную базу для первичного развёртывания. По документации Render бесплатная Postgres-база истекает через 30 дней; для постоянного production-хранения до этого срока переведите её на платный план. Netlify-прокси настроен на `https://buro-startapov-api.onrender.com/api/database`.

Существующие браузерные аккаунты, проекты и пользовательские записи синхронизируются через предусмотренный перенос после входа. При первом обращении к рейтингу API импортирует агрегированные голоса из прежнего Netlify-хранилища в Render Postgres; индивидуальная привязка старых голосов к аккаунтам не переносится.

## Новые функции Render

- Настройки темы и языка расположены в шапке сайта; выбор светлой/тёмной темы и русского/английского сохраняется в браузере.
- Миграция `0003_unicornbase_seed` добавляет 20 открытых карточек из каталога [Unicorn Base](https://unicornbase.ru/startups); каждая помечена ссылкой на источник и датой снимка 2026-10-22. Это импорт кратких полей открытого списка, а не подтверждение актуальности проектных заявлений.
- Основной API вызывает оценщик ИИ непосредственно на Render. Для него установите в переменных Web Service `INFERENCE_API_KEY`; `INFERENCE_BASE_URL` и `INFERENCE_MODEL` уже указаны в `render.yaml`. Ключ не добавляйте в Git.
- `render.yaml` также описывает отдельный Web Service `buro-startapov-admin`, открывающий панель на `https://buro-startapov-admin.onrender.com/` и использующий ту же базу. После синхронизации Blueprint задайте `ADMIN_API_TOKEN` (не менее 32 символов) в секретных переменных админского сервиса. Для генерации: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Панель показывает счётчики и активность за 30 дней и позволяет просматривать, редактировать JSON-поля и удалять строки таблиц `app_accounts`, `app_projects`, `app_votes`, `app_records`, `app_sessions`, `app_analytics`.
- Аналитика считает просмотры страниц/проектов, регистрации, создания проектов, голосования и запросы оценки ИИ; значения являются событийными счётчиками сайта, а не уникальными посетителями.
