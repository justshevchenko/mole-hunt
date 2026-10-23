// Турнірна таблиця: топ-10 і рядок поточного гравця після «…», якщо він нижче.
import { MODE_LABELS } from './format.js';

const TOP = 10;

function cell(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

export function renderLeaderboard(container, rows) {
  container.replaceChildren();
  if (!rows.length) {
    container.append(cell('board-empty', 'Поки що тут порожньо'));
    return;
  }
  rows.forEach((row) => {
    if (row.rank > TOP) container.append(cell('board-gap', '…'));
    const line = document.createElement('div');
    line.className = row.is_me ? 'board-row me' : 'board-row';
    line.append(
      cell('rank', row.rank),
      cell('name', row.name),
      cell('best', row.best),
      cell('mode-label', MODE_LABELS[row.mode] ?? row.mode),
    );
    container.append(line);
  });
}
