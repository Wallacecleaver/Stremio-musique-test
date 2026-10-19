import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, spreadPlain, toVtt, vttTime } from '../src/lrc.js';
import { cleanTrack } from '../src/youtube.js';

test('parseLrc : timestamps, multi-stamps, tri', () => {
  const l = parseLrc('[00:12.50] Salut\n[00:05.00][01:00.25]Refrain\n[00:20.00]\nbruit');
  assert.deepEqual(l.map((x) => [x.t, x.text]), [[5, 'Refrain'], [12.5, 'Salut'], [20, ''], [60.25, 'Refrain']]);
});

test('vttTime', () => assert.equal(vttTime(3723.456), '01:02:03.456'));

test('toVtt : fin = ligne suivante, plafonnée, pauses ignorées', () => {
  const vtt = toVtt([{ t: 1, text: 'A' }, { t: 3, text: '' }, { t: 40, text: 'B' }], 60);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:01\.000 --> 00:00:03\.000\nA/);
  assert.match(vtt, /00:00:40\.000 --> 00:00:50\.000\nB/);
});

test('spreadPlain : retire les [sections], reste dans la durée, croissant', () => {
  const l = spreadPlain('[Couplet 1]\nPremière ligne\nDeuxième ligne un peu plus longue\n\n[Refrain]\nFin', 200);
  assert.equal(l.length, 3);
  assert.ok(l.every((x, i) => i === 0 || x.t > l[i - 1].t));
  assert.ok(l.at(-1).t < 200);
});

test('cleanTrack', () => {
  assert.deepEqual(cleanTrack('Daft Punk - One More Time (Official Video) [HD]', 'DaftPunkVEVO'), { artist: 'Daft Punk', title: 'One More Time' });
  assert.deepEqual(cleanTrack('Titre', 'Artiste - Topic'), { artist: 'Artiste', title: 'Titre' });
});
