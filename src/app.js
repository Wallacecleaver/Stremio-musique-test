import express from 'express';
import { Readable } from 'node:stream';
import { routerFor } from './addon.js';
import { decodeConfig } from './config.js';
import { withBaseUrl, baseUrl } from './context.js';
import { cacheMode } from './cache.js';
import { getAudioFormat, getTrack, searchTracks, findClip, yt } from './youtube.js';
import { getLyricsVtt } from './lyrics.js';
import { fetchPlaylist, parsePlaylistId } from './spotify.js';
import { page } from './ui.js';
import { LOGO_PNG } from './logo.js';

const ID = /^[\w-]{11}$/;
const app = express();
app.disable('x-powered-by');
app.use(withBaseUrl);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/logo.png', (_req, res) => res.type('png').set('Cache-Control', 'public, max-age=604800').send(LOGO_PNG));

// ---------- Paroles & audio ----------
app.get('/lyrics/:id.vtt', async (req, res) => {
  const { id } = req.params;
  if (!ID.test(id)) return res.status(400).end();
  try {
    const track = await getTrack(id);
    const vtt = track && (await getLyricsVtt(id, track));
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' });
    res.type('text/vtt').send(vtt ?? 'WEBVTT\n'); // pas de paroles : VTT vide plutôt qu'une erreur
  } catch (e) {
    console.error('[lyrics]', e);
    res.status(502).type('text/vtt').send('WEBVTT\n');
  }
});

/** Relais audio avec support Range (inutile sur Vercel : YouTube bloque l'IP ; prévu pour un VPS). */
app.get('/audio/:id', async (req, res) => {
  const { id } = req.params;
  if (!ID.test(id)) return res.status(400).end();
  try {
    const { url, mime } = await getAudioFormat(id);
    const upstream = await fetch(url, { headers: req.headers.range ? { Range: req.headers.range } : {} });
    if (!upstream.ok && upstream.status !== 206) return res.status(502).end();
    res.status(upstream.status);
    res.set({ 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
    for (const h of ['content-length', 'content-range']) {
      const v = upstream.headers.get(h);
      if (v) res.set(h, v);
    }
    Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
    req.on('close', () => upstream.body.cancel().catch(() => {}));
  } catch (e) {
    console.error('[audio]', e);
    res.status(502).end();
  }
});

// ---------- API du dashboard ----------
const timed = async (id, label, fn) => {
  const t0 = Date.now();
  try {
    const detail = await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error('délai dépassé (8 s)')), 8000))]);
    return { id, label, ok: true, detail, ms: Date.now() - t0 };
  } catch (e) {
    return { id, label, ok: false, detail: e.message, ms: Date.now() - t0 };
  }
};

app.get('/api/status', async (_req, res) => {
  const checks = await Promise.all([
    timed('youtube', 'Recherche YouTube Music', async () => {
      const r = await searchTracks('daft punk');
      if (!r.length) throw new Error('aucun résultat');
      return `${r.length} résultats`;
    }),
    timed('lrclib', 'Paroles synchronisées (LRCLIB)', async () => {
      const r = await fetch('https://lrclib.net/api/search?q=daft+punk', { headers: { 'User-Agent': 'stremio-musique-paroles/0.3' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return 'joignable';
    }),
    timed('spotify', 'Lecture des playlists Spotify', async () => {
      const r = await fetch('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M', { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return 'joignable';
    }),
  ]);
  checks.push(
    { id: 'cache', label: 'Cache', ok: cacheMode === 'upstash', warn: cacheMode !== 'upstash', detail: cacheMode === 'upstash' ? 'Upstash Redis connecté' : 'mémoire locale (ajoute Upstash pour garder le cache)' },
    { id: 'genius', label: 'Paroles de secours (Genius)', ok: !!process.env.GENIUS_TOKEN, warn: !process.env.GENIUS_TOKEN, detail: process.env.GENIUS_TOKEN ? 'activé' : 'GENIUS_TOKEN absent (facultatif)' },
    { id: 'relay', label: 'Relais audio serveur', ok: true, detail: process.env.AUDIO_RELAY === 'on' ? 'activé' : 'désactivé (normal sur Vercel)' },
  );
  res.set('Cache-Control', 'no-store').json({ ok: checks.every((c) => c.ok || c.warn || c.id === 'relay'), checks });
});

app.get('/api/playlist', async (req, res) => {
  const id = parsePlaylistId(req.query.url ?? req.query.id);
  if (!id) return res.status(422).json({ error: 'Lien de playlist Spotify non reconnu.' });
  try {
    const p = await fetchPlaylist(id);
    res.set('Cache-Control', 'public, max-age=600').json({ id, name: p.name, owner: p.owner, cover: p.cover, count: p.tracks.length });
  } catch (e) {
    res.status(422).json({ error: `Lecture impossible : ${e.message}. La playlist doit être publique.` });
  }
});

app.get('/api/test', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.status(400).json({ error: 'Saisis un titre.' });
  try {
    const track = (await searchTracks(q))[0];
    if (!track) return res.json({ found: false });
    const [clip, vtt] = await Promise.all([findClip(track).catch(() => null), getLyricsVtt(track.id, track).catch(() => null)]);
    const cues = vtt ? vtt.split(/\n\n/).filter((b) => b.includes('-->')) : [];
    const note = vtt?.match(/^NOTE (.*)$/m)?.[1] ?? '';
    res.json({
      found: true,
      track,
      clip: clip ? `https://www.youtube.com/watch?v=${clip}` : null,
      lyrics: vtt && cues.length ? { lines: cues.length, synced: /synced=true/.test(note), source: note.match(/source=(\w+)/)?.[1], preview: cues.slice(0, 3).map((c) => c.split('\n').slice(1).join(' ')) } : null,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---------- Pages ----------
const html = (req, res) => res.set('Cache-Control', 'no-store').type('html').send(page({ origin: baseUrl() }));
app.get(['/', '/configure'], html);
app.get('/:cfg/configure', (req, res, next) => (decodeConfig(req.params.cfg) ? html(req, res) : next()));

// ---------- Addon Stremio : /manifest.json (défaut) et /<config>/manifest.json ----------
const logo = () => `${baseUrl()}/logo.png`;
app.use((req, res, next) => routerFor(null, logo())(req, res, next));
app.use('/:cfg', (req, res, next) => {
  const router = routerFor(req.params.cfg, logo());
  return router ? router(req, res, next) : next();
});

export default app;
