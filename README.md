# Пюпитр

Ноты и сетлисты коллектива: PDF и MusicXML из MuseScore, офлайн на сцене, листание педалью и по темпу.
Приложение ставится на домашний экран (PWA) и работает на ПК, Mac, Android и iOS.

## Как это устроено

- Клиент: Vue 3, TypeScript, Vite, Tailwind, Pinia. Публикуется на GitHub Pages через Actions при каждом пуше в `main`.
- Сервер: Supabase Free — вход по коду из письма, Postgres с RLS, приватное хранилище `scores`. Своих серверов нет.
- `.env` содержит только публичные URL и publishable key; доступ к данным решают политики RLS в `supabase/migrations`.

## Настройка с нуля

1. Создать проект Supabase и выполнить `supabase/migrations/*.sql` по порядку. Проверка политик: выполнить `supabase/tests/rls.sql`, ожидается `rls ok`.
2. Authentication → Emails → SMTP Settings: свой SMTP (например, Gmail с паролем приложения, `smtp.gmail.com:465`).
3. Authentication → Emails → Templates: в шаблонах Magic Link и Confirm signup — только код `{{ .Token }}`, без ссылки.
4. Вписать URL проекта и publishable key в локальный `.env` (в git он не идёт) и в переменные репозитория `VITE_SUPABASE_URL` и `VITE_SUPABASE_KEY` (GitHub → Settings → Secrets and variables → Actions → Variables) — из них собирается деплой.
5. Войти в приложение своей почтой и назначить себя владельцем:
   ```sql
   insert into public.members (user_id, role, email)
   select id, 'owner', email from auth.users where email = 'ваша@почта'
   on conflict (user_id) do update set role = 'owner';
   ```
6. GitHub → Settings → Pages → Source: GitHub Actions.
7. Чтобы бесплатный проект не уснул после недели тишины, завести задачу на cron-job.org: раз в 3 дня
   `GET https://<ref>.supabase.co/rest/v1/band?select=id` с заголовком `apikey: <publishable key>`.

## Разработка

```bash
npm i
npm run dev     # локальный сервер
npm test        # тесты
npm run build   # проверка типов и сборка
```
