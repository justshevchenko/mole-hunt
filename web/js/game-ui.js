// Екран гри: поле 5×5, таймер, бали, перемикач режимів. Стан гри — у engine.js.
import { createGame, tick, hit, setMode, timeLeft, CELLS, LIFETIME, MODES } from './engine.js';
import { MODE_LABELS, LEVEL_LABELS } from './format.js';

const HIT_ANIMATION_MS = 140;
const MISS_FLASH_MS = 150;

export function createGameScreen({ field, modes, time, score, level }) {
  const holes = [];
  const hitUntil = new Map();
  let game = null;
  let onEnd = null;
  let frame = 0;
  let interval = 0;

  for (let cell = 0; cell < CELLS; cell++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#mole"/></svg>';
    hole.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      press(cell);
    });
    field.appendChild(hole);
    holes.push(hole);
  }

  const modeButtons = MODES.map((mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode';
    button.textContent = MODE_LABELS[mode];
    button.addEventListener('click', () => {
      if (!game || game.over) return;
      setMode(game, mode);
      render(performance.now());
    });
    modes.appendChild(button);
    return { mode, button };
  });

  function press(cell) {
    if (!game || game.over) return;
    const now = performance.now();
    const result = hit(game, cell, now);
    if (result === 'hit') {
      hitUntil.set(cell, now + HIT_ANIMATION_MS);
    } else if (result === 'miss') {
      holes[cell].classList.add('miss');
      setTimeout(() => holes[cell].classList.remove('miss'), MISS_FLASH_MS);
    }
    step();
  }

  function render(now) {
    const up = new Set(game.moles.map((m) => m.cell));
    holes.forEach((hole, cell) => {
      const hitting = (hitUntil.get(cell) ?? 0) > now;
      hole.classList.toggle('hit', hitting);
      hole.classList.toggle('up', up.has(cell) || hitting);
    });
    time.textContent = Math.ceil(timeLeft(game, now) / 1000);
    score.textContent = game.score;
    const auto = game.mode === 'auto' ? ' (авто)' : '';
    level.textContent = `${LEVEL_LABELS[game.level]} · ${LIFETIME[game.level] / 1000} с${auto}`;
    modeButtons.forEach(({ mode, button }) => {
      button.setAttribute('aria-pressed', String(mode === game.mode));
    });
  }

  function step() {
    if (!game) return;
    const now = performance.now();
    tick(game, now);
    render(now);
    if (game.over) stop();
  }

  function loop() {
    step();
    if (game && !game.over) frame = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(frame);
    clearInterval(interval);
    hitUntil.clear();
    const finished = game;
    const callback = onEnd;
    onEnd = null;
    if (callback) callback({ score: finished.score, mode: finished.mode });
  }

  return {
    start(mode, endCallback) {
      game = createGame({ now: performance.now(), mode });
      onEnd = endCallback;
      hitUntil.clear();
      loop();
      // requestAnimationFrame засинає у фоновій вкладці; інтервал добиває гру до кінця.
      interval = setInterval(step, 100);
    },
  };
}
