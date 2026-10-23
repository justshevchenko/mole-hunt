// Чиста ігрова логіка «Полювання на кротів».
// Не звертається до DOM, Date чи Math.random напряму: час (now, мс) і
// генератор випадкових чисел передаються ззовні, тому логіку легко тестувати.

export const GAME_MS = 20000;
export const CELLS = 25;
export const MAX_MOLES = 3;

// Рівні: 0 — легкий, 1 — середній, 2 — складний, 3 — епічний.
export const LEVELS = ['easy', 'medium', 'hard', 'epic'];
export const LIFETIME = [4000, 3000, 2000, 1000];
export const SPAWN_GAP = [[600, 1000], [600, 1000], [400, 667], [200, 333]];
export const MODES = ['easy', 'medium', 'hard', 'epic', 'auto'];

const AUTO_START_LEVEL = 1;
const AUTO_STREAK_TO_LEVEL_UP = 3;

export function createGame({ now, mode = 'medium', random = Math.random }) {
  if (!MODES.includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  return {
    startedAt: now,
    endsAt: now + GAME_MS,
    score: 0,
    mode,
    level: mode === 'auto' ? AUTO_START_LEVEL : LEVELS.indexOf(mode),
    streak: 0,
    moles: [],
    nextSpawnAt: now,
    over: false,
    random,
  };
}

export function timeLeft(game, now) {
  return Math.max(0, game.endsAt - now);
}

function finishIfTimeUp(game, now) {
  if (!game.over && now >= game.endsAt) {
    game.over = true;
    game.moles = [];
  }
  return game.over;
}

function removeExpired(game, now) {
  game.moles = game.moles.filter((m) => m.expiresAt > now);
}

function randomBetween(game, [min, max]) {
  return min + game.random() * (max - min);
}

function spawn(game, now) {
  const taken = new Set(game.moles.map((m) => m.cell));
  const free = [];
  for (let cell = 0; cell < CELLS; cell++) if (!taken.has(cell)) free.push(cell);
  const cell = free[Math.floor(game.random() * free.length)];
  // Час життя фіксується в момент появи і не залежить від подальших змін рівня.
  game.moles.push({ cell, spawnedAt: now, expiresAt: now + LIFETIME[game.level] });
}

// Просуває гру до моменту now: прибирає кротів, що втекли, і додає нових.
export function tick(game, now) {
  if (finishIfTimeUp(game, now)) return game;
  removeExpired(game, now);
  if (now >= game.nextSpawnAt) {
    if (game.moles.length < MAX_MOLES) spawn(game, now);
    game.nextSpawnAt = now + randomBetween(game, SPAWN_GAP[game.level]);
  }
  return game;
}

// Натискання на клітинку. Повертає 'hit', 'miss' або 'ignored' (гра завершена).
export function hit(game, cell, now) {
  if (finishIfTimeUp(game, now)) return 'ignored';
  removeExpired(game, now);
  const index = game.moles.findIndex((m) => m.cell === cell);
  const auto = game.mode === 'auto';

  if (index >= 0) {
    game.moles.splice(index, 1);
    game.score += 1;
    if (auto && ++game.streak === AUTO_STREAK_TO_LEVEL_UP) {
      game.level = Math.min(game.level + 1, LEVELS.length - 1);
      game.streak = 0;
    }
    return 'hit';
  }

  game.score = Math.max(0, game.score - 1);
  game.streak = 0;
  if (auto) game.level = Math.max(game.level - 1, 0);
  return 'miss';
}

// Перемикання режиму посеред гри. Авто стартує з поточного рівня.
export function setMode(game, mode) {
  if (!MODES.includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  game.mode = mode;
  if (mode !== 'auto') game.level = LEVELS.indexOf(mode);
  game.streak = 0;
  return game;
}
