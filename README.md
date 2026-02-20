# Халачи — веб‑сайт + админ‑панель (fixed)

Это исправленная и переработанная версия проекта: стабильный бэкенд на Node.js + обновлённый дизайн публичной части и админки.

## Что улучшено

- ✅ Убраны «ломающие» баги (в оригинале `server.js`/CSS/JS были в одном гигантском/обрезанном виде, из-за чего проект часто не запускался корректно).
- ✅ Нормальная структура проекта (читаемый код, атомарная запись базы, обработка ошибок).
- ✅ Новый дизайн (современная тёмная тема, аккуратные карточки, модальные окна, тост‑уведомления).
- ✅ Админка стала проще и надёжнее: вход, CRUD номеров/туров/категорий, заявки, настройки, бэкап.
- ✅ Загрузка изображений: `/api/upload` (сохраняются в `public/uploads`).

## Запуск

Требования: **Node.js 16+**

```bash
npm install
npm start
```

- Сайт: `http://localhost:3000`
- Админка: `http://localhost:3000/admin`

Пароль администратора по умолчанию: **`halachi2024`**

> В админке пароль используется как заголовок `x-admin-password`.

## Данные

Хранятся в: `data/database.json`

Вы можете редактировать этот файл вручную (на свой риск), либо через админ‑панель.

## API

### Публичные

- `GET /api/data` — все данные
- `GET /api/hotel` — информация о гостинице (без пароля)
- `GET /api/rooms` — список номеров
- `GET /api/tours` — список туров
- `POST /api/booking` — заявка

### Админские (нужен заголовок)

Заголовок: `x-admin-password: halachi2024`

- `GET /api/admin/bookings` — заявки
- `POST /api/admin/bookings/:id` — поменять статус `{ status }`
- `POST /api/admin/hotel` — обновить данные гостиницы
- `POST /api/admin/visitor-count` — обновить счётчик `{ count }`
- `POST /api/admin/password` — сменить пароль `{ new_password }`
- `GET /api/admin/rooms` / `POST /api/admin/rooms` / `DELETE /api/admin/rooms/:id`
- `GET /api/admin/tours` / `POST /api/admin/tours` / `DELETE /api/admin/tours/:id`
- `GET /api/admin/categories` / `POST /api/admin/categories` / `DELETE /api/admin/categories/:id`
- `GET /api/admin/backup` — скачать бэкап

### Upload

- `POST /api/upload` (form-data поле `image`) → `{ ok, url }`

## Деплой (кратко)

- Установите зависимости на сервере: `npm ci`
- Запуск через PM2: `pm2 start server.js --name halachi`
- Перед фронтом поставьте Nginx как reverse proxy.

---

Если хочешь — могу дальше расширить: авторизация по JWT, роли пользователей, нормальная БД (PostgreSQL), календарь «шахматка», уведомления на email/Telegram.
