import test from 'node:test';
import assert from 'node:assert/strict';
import { firstWorking } from '../src/youtube.js';

test('firstWorking : saute les clients en échec et renvoie le premier qui marche', async () => {
  const tried = [];
  const r = await firstWorking(['A', 'B', 'C'], async (c) => {
    tried.push(c);
    if (c === 'A') throw new Error('Streaming data not available');
    if (c === 'B') return null;
    return { url: 'http://x' };
  });
  assert.deepEqual(tried, ['A', 'B', 'C']);
  assert.equal(r.candidate, 'C');
});

test('firstWorking : si tout échoue, l\'erreur détaille chaque client', async () => {
  await assert.rejects(
    firstWorking(['A', 'B'], async (c) => { throw new Error(`boom ${c}`); }),
    /A: boom A \| B: boom B/,
  );
});
