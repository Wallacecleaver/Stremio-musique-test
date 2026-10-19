import express from 'express';
import { Readable } from 'node:stream';
import sdk from 'stremio-addon-sdk';
import { addonInterface } from './addon.js';
import { withBaseUrl } from './context.js';
import { getAudioFormat, getTrack } from './youtube.js';
import { getLyricsVtt } from './lyrics.js';

const ID = /^[\w-]{11}$/;
const app = express();

app.use(withBaseUrl);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/lyrics/:id.vtt', async (req, res) => {
  const { id } = req.params;
  if (!ID.test(id)) return res.status(400).end();
  try {
    const track = await getTrack(id);
    const vtt = track && (await getLyricsVtt(id, track));
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' });
    // Pas de paroles : on renvoie un VTT vide plutôt qu'une erreur (le lecteur reste propre).
    res.type('text/vtt').send(vtt ?? 'WEBVTT\n');
  } catch (e) {
    console.error('[lyrics]', e);
    res.status(502).type('text/vtt').send('WEBVTT\n');
  }
});

/** Relais audio avec support Range (l'URL googlevideo est liée à l'IP du serveur). */
app.get('/audio/:id', async (req, res) => {
  const { id } = req.params;
  if (!ID.test(id)) return res.status(400).end();
  try {
    const { url, mime } = await getAudioFormat(id);
    const upstream = await fetch(url, { headers: req.headers.range ? { Range: req.headers.range } : {} });
    if (!upstream.ok && upstream.status !== 206) return res.status(502).end();
    res.status(upstream.status);
    res.set('Content-Type', mime);
    res.set('Accept-Ranges', 'bytes');
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

app.use(sdk.getRouter(addonInterface));

export default app;
