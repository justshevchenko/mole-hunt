import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsWord } from '../web/js/format.js';

test('відмінювання слова «бал»', () => {
  const cases = {
    0: 'балів', 1: 'бал', 2: 'бали', 3: 'бали', 4: 'бали', 5: 'балів',
    11: 'балів', 12: 'балів', 14: 'балів', 21: 'бал', 22: 'бали', 25: 'балів',
    101: 'бал', 111: 'балів',
  };
  for (const [n, word] of Object.entries(cases)) {
    assert.equal(pointsWord(Number(n)), word, `${n} ${word}`);
  }
});
