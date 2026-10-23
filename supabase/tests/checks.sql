-- Перевірки SQL-функцій «Полювання на кротів».
-- Запуск: вставити весь файл у SQL Editor Supabase. Усе виконується в транзакції
-- з rollback, тому дані в таблицях не змінюються. Лічильник гостей не
-- транзакційний — скрипт відновлює його значення наприкінці.
-- Успіх: скрипт завершується без помилок; кожна перевірка — assert.

begin;

create temp table saved_guest_seq as
  select last_value, is_called from public.guest_no_seq;

-- Чиста таблиця всередині транзакції, щоб місця не залежали від реальних даних.
delete from public.scores;
delete from public.players;

-- 4.2 register_player / get_player ------------------------------------------
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  name_a text;
  name_b text;
begin
  assert public.get_player(a) is null, 'новий гравець має бути незареєстрованим';

  name_a := public.register_player(a, '');
  name_b := public.register_player(b, null);
  assert name_a like 'Гість %' and name_b like 'Гість %', 'порожнє ім''я → Гість N';
  assert name_a <> name_b, 'два гості отримують різні номери';

  assert public.register_player(c, '  Катя  ') = 'Катя', 'ім''я обрізається';
  assert public.register_player(c, 'Інше') = 'Катя', 'повторний виклик не змінює ім''я';
  assert public.register_player(a, 'Катя') = name_a, 'гість лишається гостем';
  assert public.get_player(c) = 'Катя', 'get_player повертає ім''я';

  begin
    perform public.register_player(gen_random_uuid(), repeat('я', 21));
    assert false, 'ім''я з 21 символу має відхилятися';
  exception when invalid_parameter_value then null;
  end;

  -- 20 символів — допустимо
  assert char_length(public.register_player(gen_random_uuid(), repeat('я', 20))) = 20;
end $$;

-- 4.3 submit_score / get_leaderboard ----------------------------------------
delete from public.scores;
delete from public.players;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  r jsonb;
  board record;
  i int;
  me uuid;
begin
  perform public.register_player(a, 'A');
  perform public.register_player(b, 'B');
  perform public.register_player(c, 'C');
  perform public.register_player(d, 'D');

  -- Межі результату
  begin
    perform public.submit_score(a, 500, 'easy');
    assert false, '500 балів має відхилятися';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.submit_score(a, -1, 'easy');
    assert false, 'від''ємні бали мають відхилятися';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.submit_score(a, 5, 'turbo');
    assert false, 'невідомий режим має відхилятися';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.submit_score(gen_random_uuid(), 5, 'easy');
    assert false, 'незареєстрований гравець має відхилятися';
  exception when invalid_parameter_value then null;
  end;
  assert (public.submit_score(d, 110, 'epic')->>'rank')::int = 1, '110 — допустимо';
  delete from public.scores where player_id = d;

  -- Перша гра в трійці → кубок
  r := public.submit_score(a, 10, 'medium');
  assert r->>'cup' = 'gold' and (r->>'rank')::int = 1, 'перша гра: золото';

  -- Рівні результати: B набрав 10 пізніше → нижче за A
  r := public.submit_score(b, 10, 'hard');
  assert (r->>'rank')::int = 2 and r->>'cup' = 'silver', 'рівні бали пізніше → 2 місце';

  -- Повторення власного рекорду: A лишається вище за B, кубок золотий
  r := public.submit_score(a, 10, 'easy');
  assert (r->>'rank')::int = 1 and r->>'cup' = 'gold', 'повторення рекорду на 1 місці → золото';
  assert (r->>'best_before')::int = 10;

  -- Результат гірший за рекорд → без кубка
  r := public.submit_score(a, 9, 'easy');
  assert r->>'cup' is null and (r->>'rank')::int = 1, 'гірше за рекорд → без кубка';

  -- Новий рекорд → золото
  r := public.submit_score(a, 11, 'auto');
  assert r->>'cup' = 'gold', 'новий рекорд на 1 місці → золото';

  -- Режим рекорду — режим першої гри з максимальним балом
  select * into board from public.get_leaderboard(a) where is_me;
  assert board.best = 11 and board.mode = 'auto' and board.rank = 1, 'рекорд в авторежимі → Авто';

  -- Нульовий результат на 3 місці → без кубка
  r := public.submit_score(c, 0, 'easy');
  assert (r->>'rank')::int = 3 and r->>'cup' is null, '0 балів → без кубка';

  -- Підйом у трійку з 4-го місця
  r := public.submit_score(d, 1, 'easy');
  assert (r->>'rank')::int = 3 and r->>'cup' = 'bronze', 'підйом на 3 місце → бронза';

  -- Гравець на 17-му місці з 25: топ-10 + його рядок
  delete from public.scores;
  for i in 1..25 loop
    me := gen_random_uuid();
    perform public.register_player(me, 'P' || i);
    perform public.submit_score(me, 100 - i, 'medium');
    if i = 17 then
      d := me;
    end if;
  end loop;

  assert (select count(*) from public.get_leaderboard(d)) = 11, 'топ-10 + рядок гравця';
  select * into board from public.get_leaderboard(d) where is_me;
  assert board.rank = 17 and board.name = 'P17' and board.best = 83, 'гравець на 17 місці';
  assert (select count(*) from public.get_leaderboard(gen_random_uuid())) = 10, 'без результатів — лише топ-10';
  assert (select max(rank) from public.get_leaderboard(null)) = 10;
  assert (select count(*) from public.get_leaderboard(d) where rank <= 10 and is_me) = 0;
end $$;

select setval('public.guest_no_seq', last_value, is_called) from saved_guest_seq;

rollback;

-- setval вище не відкочується разом із транзакцією, тому лічильник гостей
-- лишається таким, яким був до перевірок.

-- 4.4 Таблиці закриті для publishable/anon-ключа --------------------------
-- Виконати в терміналі (URL і KEY — з web/js/config.js):
--
--   URL=https://<project>.supabase.co ; KEY=<publishable key>
--
--   # Прямий доступ до таблиць — відмова (HTTP 401, permission denied):
--   curl -s -w ' %{http_code}\n' "$URL/rest/v1/players?select=*" -H "apikey: $KEY"
--   curl -s -w ' %{http_code}\n' "$URL/rest/v1/scores?select=*" -H "apikey: $KEY"
--   curl -s -w ' %{http_code}\n' -X POST "$URL/rest/v1/scores" -H "apikey: $KEY" \
--        -H 'Content-Type: application/json' -d '{"player_id":"00000000-0000-0000-0000-000000000000","score":100,"mode":"easy"}'
--   curl -s -w ' %{http_code}\n' -X DELETE "$URL/rest/v1/players?id=not.is.null" -H "apikey: $KEY"
--
--   # Внутрішня функція ранжування недоступна (схема private не в API):
--   curl -s -w ' %{http_code}\n' -X POST "$URL/rest/v1/rpc/ranked" -H "apikey: $KEY" -d '{}'
--
--   # Функції для браузера працюють (HTTP 200):
--   curl -s -w ' %{http_code}\n' -X POST "$URL/rest/v1/rpc/get_leaderboard" -H "apikey: $KEY" \
--        -H 'Content-Type: application/json' -d '{"p_id":null}'
