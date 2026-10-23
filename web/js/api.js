// Виклики SQL-функцій Supabase. Таблиці закриті для браузера (RLS),
// тому вся робота з даними йде лише через ці чотири функції.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

let clientPromise = null;

// Бібліотека вантажиться ліниво: без мережі гра працює, падає лише збереження.
function client() {
  clientPromise ??= import(SUPABASE_JS)
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }))
    .catch((error) => {
      clientPromise = null;
      throw error;
    });
  return clientPromise;
}

async function call(fn, args) {
  const { data, error } = await (await client()).rpc(fn, args);
  if (error) throw error;
  return data;
}

export const getPlayer = (playerId) => call('get_player', { p_id: playerId });

export const registerPlayer = (playerId, name) =>
  call('register_player', { p_id: playerId, p_name: name });

export const submitScore = (playerId, score, mode) =>
  call('submit_score', { p_id: playerId, p_score: score, p_mode: mode });

export const getLeaderboard = (playerId) => call('get_leaderboard', { p_id: playerId });
