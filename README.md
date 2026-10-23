# 🐹 Mole Hunt

«Полювання на кротів» — браузерна гра: за 20 секунд влучити в якомога більше кротів на полі 5×5. Спільна таблиця лідерів для всіх гравців.

Грати: https://justshevchenko.github.io/mole-hunt/

## Структура

- `web/` — сайт без кроку збирання (HTML, CSS, ES-модулі); публікується на GitHub Pages
  - `js/engine.js` — ігрова логіка без DOM (поле, кроти, бали, рівні, авторежим)
  - `js/config.js` — URL і publishable-ключ Supabase
- `tests/` — юніт-тести (`node --test`)
- `supabase/migrations/` — схема бази і SQL-функції
- `supabase/tests/checks.sql` — перевірки SQL-функцій і закритості таблиць
- `openspec/` — специфікації та плани змін ([OpenSpec](https://github.com/Fission-AI/OpenSpec))
- `.claude/` — команди `/opsx:*` для Claude Code

## Запуск локально

Потрібен Node.js 22 або новіший.

```bash
npm start
```

Сайт відкриється на http://localhost:3000. Відкривати `web/index.html` напряму з диска не можна: браузер не завантажує ES-модулі з `file://`.

Тести:

```bash
npm test
```

## Supabase

### Новий проєкт

1. Створіть проєкт на [supabase.com](https://supabase.com) (безкоштовний тариф підходить).
2. Відкрийте **SQL Editor**, вставте вміст `supabase/migrations/0001_init.sql` і натисніть **Run**.
3. Щоб перевірити функції, вставте в SQL Editor `supabase/tests/checks.sql` і запустіть: скрипт має завершитися без помилок. Він працює в транзакції з відкатом і не залишає даних.
4. У **Project Settings → API Keys** скопіюйте URL проєкту і **publishable**-ключ (`sb_publishable_…`) та впишіть їх у `web/js/config.js`.

Publishable-ключ можна зберігати в репозиторії: таблиці закриті RLS, а браузер може викликати лише функції `get_player`, `register_player`, `submit_score` і `get_leaderboard`. Сервісний (secret) ключ у репозиторій не додавайте.

### Якщо проєкт на паузі

Безкоштовний проєкт Supabase ставиться на паузу після ~7 днів без запитів. Тоді гра працює, але результат не зберігається («Не вдалося зберегти результат»). Відкрийте проєкт у [панелі Supabase](https://supabase.com/dashboard) і натисніть **Restore project** — дані зберігаються.

## Публікація

Кожен пуш у `main` запускає `.github/workflows/pages.yml`: спершу `npm test`, потім публікацію теки `web/` на GitHub Pages. У налаштуваннях репозиторію **Settings → Pages → Source** має бути вибрано **GitHub Actions**.

## Робочий процес

1. `/opsx:propose <ідея>` — створити план зміни
2. `/opsx:apply` — реалізувати
3. `/opsx:archive` — заархівувати після завершення
