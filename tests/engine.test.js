import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, hit, setMode, timeLeft,
  GAME_MS, CELLS, MAX_MOLES, LIFETIME, SPAWN_GAP,
} from '../web/js/engine.js';

// Детермінований «випадковий» генератор: 0 → мінімальний інтервал і перша вільна клітинка.
const constant = (value) => () => value;

function newGame(mode = 'medium', random = constant(0)) {
  return createGame({ now: 0, mode, random });
}

// Ставить крота в задану клітинку напряму, щоб тести влучань не залежали від появи.
function placeMole(game, cell, now = 0) {
  game.moles.push({ cell, spawnedAt: now, expiresAt: now + LIFETIME[game.level] });
}

function hitStreak(game, count, now) {
  for (let i = 0; i < count; i++) {
    placeMole(game, i % CELLS, now);
    assert.equal(hit(game, i % CELLS, now), 'hit');
  }
}

describe('таймер і завершення гри', () => {
  test('відлік з 20 секунд до 0', () => {
    const game = newGame();
    assert.equal(timeLeft(game, 0), GAME_MS);
    assert.equal(timeLeft(game, 5000), 15000);
    assert.equal(timeLeft(game, 25000), 0);
  });

  test('гра завершується на 20 000 мс і кроти зникають', () => {
    const game = newGame();
    tick(game, 19999);
    assert.equal(game.over, false);
    assert.ok(game.moles.length > 0);
    tick(game, 20000);
    assert.equal(game.over, true);
    assert.deepEqual(game.moles, []);
  });

  test('після завершення натискання не змінюють бали', () => {
    const game = newGame();
    placeMole(game, 0);
    hit(game, 0, 100);
    assert.equal(game.score, 1);
    tick(game, GAME_MS);
    assert.equal(hit(game, 3, GAME_MS + 10), 'ignored');
    assert.equal(game.score, 1);
  });

  test('натискання рівно в момент завершення ігнорується', () => {
    const game = newGame();
    placeMole(game, 0, 19000);
    assert.equal(hit(game, 0, GAME_MS), 'ignored');
    assert.equal(game.score, 0);
  });
});

describe('поява кротів', () => {
  test('перший кріт з’являється одразу на старті', () => {
    const game = newGame();
    tick(game, 0);
    assert.equal(game.moles.length, 1);
  });

  test('на полі не більше 3 кротів одночасно', () => {
    const game = newGame('easy');
    for (let t = 0; t <= 3000; t += 50) tick(game, t);
    assert.equal(game.moles.length, MAX_MOLES);
  });

  test('кріт з’являється лише у вільній клітинці', () => {
    const game = newGame('easy');
    for (let t = 0; t <= 3000; t += 50) tick(game, t);
    const cells = game.moles.map((m) => m.cell);
    assert.equal(new Set(cells).size, cells.length);
    cells.forEach((c) => assert.ok(c >= 0 && c < CELLS));
  });

  test('поле не залишається порожнім довше 1 секунди', () => {
    const game = newGame('medium', constant(0.999));
    let emptySince = null;
    for (let t = 0; t < GAME_MS; t += 10) {
      tick(game, t);
      if (game.moles.length === 0) {
        emptySince ??= t;
        assert.ok(t - emptySince <= 1000, `поле порожнє ${t - emptySince} мс`);
      } else {
        emptySince = null;
      }
      game.moles.slice().forEach((m) => hit(game, m.cell, t)); // влучаємо в усіх одразу
    }
  });

  test('інтервал появи на середньому рівні — 0,6–1 с', () => {
    const slow = newGame('medium', constant(0.999));
    tick(slow, 0);
    assert.ok(slow.nextSpawnAt > 990 && slow.nextSpawnAt <= 1000);
    const fast = newGame('medium', constant(0));
    tick(fast, 0);
    assert.equal(fast.nextSpawnAt, 600);
  });

  test('на епічному рівні інтервал 0,2–0,33 с', () => {
    const game = newGame('epic', constant(0));
    tick(game, 0);
    assert.equal(game.nextSpawnAt, SPAWN_GAP[3][0]);
    const slow = newGame('epic', constant(0.999));
    tick(slow, 0);
    assert.ok(slow.nextSpawnAt <= 333);
  });

  test('на складному рівні інтервал 0,4–0,67 с', () => {
    const game = newGame('hard', constant(0));
    tick(game, 0);
    assert.equal(game.nextSpawnAt, 400);
  });

  test('зміна рівня змінює темп появи', () => {
    const game = newGame('auto', constant(0));
    tick(game, 0);
    assert.equal(game.nextSpawnAt, 600);
    hitStreak(game, 3, 100);
    assert.equal(game.level, 2);
    tick(game, 600);
    assert.equal(game.nextSpawnAt, 600 + 400);
  });
});

describe('зникання кротів', () => {
  test('кріт втік — бали не змінюються', () => {
    const game = newGame();
    tick(game, 0);
    assert.equal(game.moles.length, 1);
    game.nextSpawnAt = Infinity; // більше нікого не додаємо
    tick(game, LIFETIME[1]);
    assert.equal(game.moles.length, 0);
    assert.equal(game.score, 0);
  });
});

describe('влучання і штраф', () => {
  test('влучання дає +1 і кріт одразу зникає', () => {
    const game = newGame();
    placeMole(game, 7);
    assert.equal(hit(game, 7, 100), 'hit');
    assert.equal(game.score, 1);
    assert.equal(game.moles.some((m) => m.cell === 7), false);
  });

  test('повторне натискання після влучання рахується як промах', () => {
    const game = newGame();
    placeMole(game, 7);
    hit(game, 7, 100);
    assert.equal(hit(game, 7, 120), 'miss');
    assert.equal(game.score, 0);
  });

  test('промах при 5 балах — стає 4', () => {
    const game = newGame();
    game.score = 5;
    assert.equal(hit(game, 3, 100), 'miss');
    assert.equal(game.score, 4);
  });

  test('промах при 0 балах — лишається 0', () => {
    const game = newGame();
    hit(game, 3, 100);
    assert.equal(game.score, 0);
  });

  test('натискання на крота, що вже втік, — промах', () => {
    const game = newGame();
    placeMole(game, 2, 0);
    assert.equal(hit(game, 2, LIFETIME[1]), 'miss');
  });
});

describe('рівні швидкості і фіксовані режими', () => {
  test('час життя крота за рівнем: легкий 4 с, епічний 1 с', () => {
    for (const [mode, life] of [['easy', 4000], ['medium', 3000], ['hard', 2000], ['epic', 1000]]) {
      const game = newGame(mode);
      tick(game, 0);
      assert.equal(game.moles[0].expiresAt, life, mode);
    }
  });

  test('старт у фіксованому режимі «Складний» — кроти живуть 2 с', () => {
    const game = newGame('hard');
    assert.equal(game.level, 2);
  });

  test('зміна рівня не впливає на кротів, що вже на полі', () => {
    const game = newGame('medium');
    tick(game, 0);
    const first = game.moles[0];
    setMode(game, 'epic');
    game.nextSpawnAt = 1000;
    tick(game, 1000);
    assert.equal(first.expiresAt, 3000);
    const second = game.moles.find((m) => m !== first);
    assert.equal(second.expiresAt, 1000 + 1000);
    game.nextSpawnAt = Infinity;
    tick(game, 2500);
    assert.ok(game.moles.includes(first));
    tick(game, 3000);
    assert.ok(!game.moles.includes(first));
  });

  test('перемикання з авто на фіксований — рівень більше не змінюється сам', () => {
    const game = newGame('auto');
    setMode(game, 'easy');
    assert.equal(game.level, 0);
    hitStreak(game, 6, 100);
    assert.equal(game.level, 0);
  });

  test('у фіксованому режимі промах не змінює рівень', () => {
    const game = newGame('hard');
    hit(game, 0, 100);
    assert.equal(game.level, 2);
  });
});

describe('авторежим', () => {
  test('старт в авторежимі — середній рівень', () => {
    assert.equal(newGame('auto').level, 1);
  });

  test('3 влучання поспіль — рівень +1 і серія скидається', () => {
    const game = newGame('auto');
    hitStreak(game, 3, 100);
    assert.equal(game.level, 2);
    assert.equal(game.streak, 0);
    hitStreak(game, 2, 200);
    assert.equal(game.level, 2);
    hitStreak(game, 1, 300);
    assert.equal(game.level, 3);
  });

  test('на епічному рівні підвищення не відбувається', () => {
    const game = newGame('auto');
    game.level = 3;
    hitStreak(game, 3, 100);
    assert.equal(game.level, 3);
  });

  test('послідовні промахи: епічний → складний → середній', () => {
    const game = newGame('auto');
    game.level = 3;
    hit(game, 0, 100);
    assert.equal(game.level, 2);
    hit(game, 0, 200);
    assert.equal(game.level, 1);
  });

  test('промах при нульовому рахунку знижує рівень, бали лишаються 0', () => {
    const game = newGame('auto');
    hit(game, 0, 100);
    assert.equal(game.level, 0);
    assert.equal(game.score, 0);
  });

  test('на легкому рівні зниження не відбувається', () => {
    const game = newGame('auto');
    game.level = 0;
    hit(game, 0, 100);
    assert.equal(game.level, 0);
  });

  test('промах скидає серію влучань', () => {
    const game = newGame('auto');
    hitStreak(game, 2, 100);
    hit(game, 20, 150);
    assert.equal(game.level, 0);
    hitStreak(game, 2, 200);
    assert.equal(game.level, 0);
  });

  test('кріт, що втік, не змінює рівень і серію', () => {
    const game = newGame('auto');
    hitStreak(game, 2, 0);
    placeMole(game, 9, 0);
    game.nextSpawnAt = Infinity;
    tick(game, LIFETIME[1]);
    assert.equal(game.level, 1);
    assert.equal(game.streak, 2);
  });

  test('увімкнення авто посеред гри — з поточного рівня, серія з нуля', () => {
    const game = newGame('hard');
    game.streak = 2;
    setMode(game, 'auto');
    assert.equal(game.level, 2);
    assert.equal(game.streak, 0);
  });
});
