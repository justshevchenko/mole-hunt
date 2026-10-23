// Переходи між екранами: старт → гра → результат → «Грати ще» → гра.
import { createGameScreen } from './game-ui.js';
import { createResultsScreen } from './results.js';
import { getPlayerId } from './player.js';
import { getPlayer } from './api.js';

const $ = (id) => document.getElementById(id);

const screens = {
  start: $('screen-start'),
  game: $('screen-game'),
  results: $('screen-results'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => { node.hidden = key !== name; });
  window.scrollTo(0, 0);
}

const playerId = getPlayerId();

const gameScreen = createGameScreen({
  field: $('field'),
  modes: $('modes'),
  time: $('hud-time'),
  score: $('hud-score'),
  level: $('hud-level'),
});

const results = createResultsScreen({
  score: $('res-score'),
  word: $('res-word'),
  cup: $('res-cup'),
  cupCaption: $('res-cup-caption'),
  nameForm: $('name-form'),
  nameInput: $('name-input'),
  nameError: $('name-error'),
  skip: $('btn-skip'),
  saveError: $('save-error'),
  retry: $('btn-retry'),
  board: $('board'),
  boardRows: $('board-rows'),
}, playerId);

// Перша гра — «Середній», наступні — у режимі кінця попередньої.
let lastMode = 'medium';

function play() {
  showScreen('game');
  gameScreen.start(lastMode, (finished) => {
    lastMode = finished.mode;
    showScreen('results');
    results.show(finished);
  });
}

$('btn-start').addEventListener('click', play);
$('btn-again').addEventListener('click', play);

// Заздалегідь дізнаємося, чи гравець уже зареєстрований. Помилку ігноруємо:
// екран результату спробує ще раз і покаже її, якщо треба.
getPlayer(playerId).then((name) => results.setKnownName(name), () => {});
