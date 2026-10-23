// Екран результату: бали, запит імені після першої гри, кубок і таблиця.
import * as api from './api.js';
import { renderLeaderboard } from './leaderboard.js';
import { pointsWord, CUP_CAPTIONS } from './format.js';

const MAX_NAME = 20;

export function createResultsScreen(el, playerId) {
  let playerName; // undefined — ще не знаємо, null — не зареєстрований
  let game = null;
  let retry = null;
  let token = 0;

  const show = (node, visible) => { node.hidden = !visible; };

  function fail(action) {
    retry = action;
    show(el.saveError, true);
  }

  async function guarded(current, action) {
    try {
      await action();
    } catch (error) {
      if (current === token) {
        console.error(error);
        fail(() => guarded(current, action));
      }
    }
  }

  async function save(current) {
    // Повтор після помилки таблиці не записує ту саму гру вдруге.
    const result = game.saved ??= await api.submitScore(playerId, game.score, game.mode);
    const rows = await api.getLeaderboard(playerId);
    if (current !== token) return;
    if (result.cup) {
      el.cup.className = `cup cup-${result.cup}`;
      el.cupCaption.textContent = CUP_CAPTIONS[result.cup];
      show(el.cup, true);
    }
    renderLeaderboard(el.boardRows, rows);
    show(el.board, true);
  }

  async function register(current, name) {
    playerName = await api.registerPlayer(playerId, name);
    if (current !== token) return;
    show(el.nameForm, false);
    await save(current);
  }

  async function start(current) {
    if (playerName === undefined) playerName = await api.getPlayer(playerId);
    if (current !== token) return;
    if (playerName === null) {
      el.nameInput.value = '';
      show(el.nameError, false);
      show(el.nameForm, true);
      el.nameInput.focus();
    } else {
      await save(current);
    }
  }

  el.nameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = el.nameInput.value.trim();
    if (name.length > MAX_NAME) {
      show(el.nameError, true);
      return;
    }
    show(el.saveError, false);
    const current = token;
    guarded(current, () => register(current, name));
  });

  el.skip.addEventListener('click', () => {
    show(el.saveError, false);
    const current = token;
    guarded(current, () => register(current, ''));
  });

  el.nameInput.addEventListener('input', () => show(el.nameError, false));

  el.retry.addEventListener('click', () => {
    show(el.saveError, false);
    if (retry) retry();
  });

  return {
    // Ім'я з сервера, отримане заздалегідь, щоб екран результату не блимав.
    setKnownName(name) {
      if (playerName === undefined) playerName = name;
    },
    show(finished) {
      game = finished;
      const current = ++token;
      retry = null;
      el.score.textContent = finished.score;
      el.word.textContent = pointsWord(finished.score);
      [el.cup, el.nameForm, el.saveError, el.board].forEach((node) => show(node, false));
      guarded(current, () => start(current));
    },
  };
}
