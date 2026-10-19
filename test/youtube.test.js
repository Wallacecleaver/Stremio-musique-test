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

import { isSameTrack } from '../src/youtube.js';

const song = { id: 'AAA', title: 'Firmament', artist: 'Django', duration: 130 };

test('isSameTrack : accepte le clip du même morceau', () => {
  assert.equal(isSameTrack(song, { id: 'BBB', title: 'Django - Firmament (Clip Officiel)', artist: 'Django', duration: 135 }), true);
});

test('isSameTrack : refuse la même vidéo, une autre durée, un live ou un autre artiste', () => {
  assert.equal(isSameTrack(song, { ...song }), false);
  assert.equal(isSameTrack(song, { id: 'B', title: 'Firmament', artist: 'Django', duration: 400 }), false);
  assert.equal(isSameTrack(song, { id: 'B', title: 'Firmament (Live)', artist: 'Django', duration: 130 }), false);
  assert.equal(isSameTrack(song, { id: 'B', title: 'Firmament', artist: 'Quelqu\u2019un', duration: 130 }), false);
});

test('isSameTrack : insensible aux accents et à la casse', () => {
  const t = { id: 'A', title: 'Éternité', artist: 'Étienne', duration: 200 };
  assert.equal(isSameTrack(t, { id: 'B', title: 'ETERNITE (clip)', artist: 'Etienne', duration: 200 }), true);
});
