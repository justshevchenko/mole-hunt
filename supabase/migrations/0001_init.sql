-- «Полювання на кротів»: гравці, результати і SQL-функції для браузера.
--
-- Браузер має лише publishable/anon-ключ, тому таблиці закриті RLS без політик,
-- а з даними можна працювати тільки через функції security definer нижче.
--
-- Відкат:
--   drop function if exists public.get_leaderboard(uuid);
--   drop function if exists public.submit_score(uuid, int, text);
--   drop function if exists public.register_player(uuid, text);
--   drop function if exists public.get_player(uuid);
--   drop schema if exists private cascade;
--   drop table if exists public.scores;
--   drop table if exists public.players;
--   drop sequence if exists public.guest_no_seq;

-- Таблиці ----------------------------------------------------------------

create table public.players (
  id uuid primary key,
  name text not null
    check (char_length(name) between 1 and 20 and name = btrim(name)),
  guest_no int unique,
  created_at timestamptz not null default now()
);

create table public.scores (
  id bigserial primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  score int not null check (score between 0 and 110),
  mode text not null check (mode in ('easy', 'medium', 'hard', 'epic', 'auto')),
  -- clock_timestamp, а не now(): кілька ігор в одній транзакції мають різний час.
  created_at timestamptz not null default clock_timestamp()
);

create index scores_best_idx on public.scores (player_id, score desc, created_at asc);

create sequence public.guest_no_seq;

alter table public.players enable row level security;
alter table public.scores enable row level security;

revoke all on table public.players, public.scores from anon, authenticated;
revoke all on sequence public.guest_no_seq, public.scores_id_seq from anon, authenticated;

-- Ранжування (не доступне через API) ---------------------------------------

create schema private;
revoke all on schema private from public, anon, authenticated;

-- Найкращий результат кожного гравця: перша гра з максимальним балом.
-- При рівних балах вище той, хто досягнув результату раніше.
create function private.ranked()
returns table (player_id uuid, name text, best int, mode text, achieved_at timestamptz, rank bigint)
language sql
stable
set search_path = ''
as $$
  with best as (
    select distinct on (s.player_id) s.player_id, s.score, s.mode, s.created_at
    from public.scores s
    order by s.player_id, s.score desc, s.created_at asc
  )
  select b.player_id, p.name, b.score, b.mode, b.created_at,
         row_number() over (order by b.score desc, b.created_at asc, b.player_id)
  from best b
  join public.players p on p.id = b.player_id;
$$;

revoke execute on function private.ranked() from public, anon, authenticated;

-- Функції для браузера ------------------------------------------------------

create function public.get_player(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.players where id = p_id;
$$;

-- Порожнє ім'я → «Гість N». Наявного гравця не змінює і повертає його ім'я.
create function public.register_player(p_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_guest_no int;
begin
  if p_id is null then
    raise exception 'player id is required' using errcode = '22023';
  end if;

  select name into v_name from public.players where id = p_id;
  if found then
    return v_name;
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    v_guest_no := nextval('public.guest_no_seq');
    v_name := 'Гість ' || v_guest_no;
  elsif char_length(v_name) > 20 then
    raise exception 'name must be 1-20 characters' using errcode = '22023';
  end if;

  insert into public.players (id, name, guest_no)
  values (p_id, v_name, v_guest_no)
  on conflict (id) do nothing;

  select name into v_name from public.players where id = p_id;
  return v_name;
end;
$$;

-- Записує гру і повертає місце та кубок (gold/silver/bronze або null).
-- Межа 110: на епічному рівні за 20 с з'являється не більше ~101 крота.
create function public.submit_score(p_id uuid, p_score int, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_best_before int;
  v_rank bigint;
  v_cup text;
begin
  if not exists (select 1 from public.players where id = p_id) then
    raise exception 'unknown player' using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > 110 then
    raise exception 'score out of range' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('easy', 'medium', 'hard', 'epic', 'auto') then
    raise exception 'unknown mode' using errcode = '22023';
  end if;

  select max(score) into v_best_before from public.scores where player_id = p_id;

  insert into public.scores (player_id, score, mode) values (p_id, p_score, p_mode);

  select r.rank into v_rank from private.ranked() r where r.player_id = p_id;

  if p_score >= 1 and (v_best_before is null or p_score >= v_best_before) and v_rank <= 3 then
    v_cup := case v_rank when 1 then 'gold' when 2 then 'silver' else 'bronze' end;
  end if;

  return jsonb_build_object(
    'score', p_score,
    'best_before', v_best_before,
    'rank', v_rank,
    'cup', v_cup
  );
end;
$$;

-- Топ-10 і рядок поточного гравця, якщо він нижче 10-го місця.
create function public.get_leaderboard(p_id uuid)
returns table (rank bigint, name text, best int, mode text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rank, r.name, r.best, r.mode, coalesce(r.player_id = p_id, false)
  from private.ranked() r
  where r.rank <= 10 or r.player_id = p_id
  order by r.rank;
$$;

revoke execute on function
  public.get_player(uuid),
  public.register_player(uuid, text),
  public.submit_score(uuid, int, text),
  public.get_leaderboard(uuid)
from public;

grant execute on function
  public.get_player(uuid),
  public.register_player(uuid, text),
  public.submit_score(uuid, int, text),
  public.get_leaderboard(uuid)
to anon, authenticated;
