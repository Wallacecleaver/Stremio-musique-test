import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeConfig, decodeConfig, sanitize, DEFAULTS } from '../src/config.js';
import { parsePlaylistId, parseEmbed } from '../src/spotify.js';
import { encodeQuery, decodeQuery, mapLimit } from '../src/resolve.js';
import { bigThumb } from '../src/youtube.js';
import { buildManifest } from '../src/addon.js';

test('config : aller-retour, accents, et valeurs invalides ignorées', () => {
  const cfg = { type: 'movie', playlists: [{ id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Été 2026 ♪' }, { id: 'pas valide!', name: 'x' }] };
  const back = decodeConfig(encodeConfig(cfg));
  assert.deepEqual(back, { type: 'movie', playlists: [{ id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Été 2026 ♪' }] });
  assert.equal(decodeConfig('manifest.json'), null);
  assert.equal(decodeConfig('!!!!!!!!!!'), null);
  assert.equal(sanitize({ type: 'hack' }).type, DEFAULTS.type);
});

test('config : dédoublonne et plafonne à 10 playlists', () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `a${String(i).padStart(21, '0')}`, name: `P${i}` }));
  assert.equal(sanitize({ playlists: [...many, many[0]] }).playlists.length, 10);
});

test('parsePlaylistId : url, uri, id brut', () => {
  const id = '37i9dQZF1DXcBWIGoYBM5M';
  assert.equal(parsePlaylistId(`https://open.spotify.com/playlist/${id}?si=abc`), id);
  assert.equal(parsePlaylistId(`https://open.spotify.com/intl-fr/playlist/${id}`), id);
  assert.equal(parsePlaylistId(`spotify:playlist:${id}`), id);
  assert.equal(parsePlaylistId(id), id);
  assert.equal(parsePlaylistId('https://open.spotify.com/track/xyz'), null);
});

test('parseEmbed : lit titres, artistes, durées et pochette', () => {
  const data = { props: { pageProps: { state: { data: { entity: {
    name: 'Ma playlist', subtitle: 'Yanis', coverArt: { sources: [{ url: 'small' }, { url: 'big' }] },
    trackList: [
      { title: 'Firmament', subtitle: 'Django', duration: 130000, isPlayable: true },
      { title: 'Duo', subtitle: 'A\u00a0Un, B', duration: 200500, isPlayable: true },
      { title: 'Retiré', subtitle: 'X', duration: 1000, isPlayable: false },
    ] } } } } } };
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
  const p = parseEmbed(html);
  assert.equal(p.name, 'Ma playlist');
  assert.equal(p.cover, 'big');
  assert.deepEqual(p.tracks.map((t) => [t.title, t.artist, t.duration]), [['Firmament', 'Django', 130], ['Duo', 'A Un', 201]]);
  assert.throws(() => parseEmbed('<html></html>'), /inattendue/);
});

test('ids ytq : aller-retour sans cache', () => {
  const q = { title: 'Éternité', artist: 'Étienne', duration: 200 };
  assert.deepEqual(decodeQuery(encodeQuery(q)), q);
  assert.equal(decodeQuery('ytq:%%%'), null);
});

test('bigThumb : agrandit les pochettes googleusercontent', () => {
  assert.equal(bigThumb('https://lh3.googleusercontent.com/abc=w226-h226-l90-rj'), 'https://lh3.googleusercontent.com/abc=w600-h600-l90-rj');
  assert.equal(bigThumb('https://i.ytimg.com/vi/x/hq.jpg'), 'https://i.ytimg.com/vi/x/hq.jpg');
});

test('mapLimit : ordre conservé, erreurs -> null, budget respecté', async () => {
  const r = await mapLimit([1, 2, 3, 4], 2, async (n) => { if (n === 3) throw new Error('x'); return n * 2; });
  assert.deepEqual(r, [2, 4, null, 8]);
  const slow = await mapLimit([1, 2, 3], 1, () => new Promise((res) => setTimeout(() => res('ok'), 40)), 50);
  assert.ok(slow.includes(null));
});

test('manifest : une rangée par playlist, type configuré', () => {
  const m = buildManifest({ type: 'music', playlists: [{ id: 'a'.repeat(22), name: 'Ma playlist' }] });
  assert.deepEqual(m.types, ['music']);
  assert.deepEqual(m.catalogs.map((c) => c.id), ['search', `pl:${'a'.repeat(22)}`]);
  assert.ok(m.catalogs.every((c) => c.type === 'music'));
  assert.equal(m.behaviorHints.configurable, true);
});
