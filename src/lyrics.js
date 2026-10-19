import * as cheerio from 'cheerio';
import { cached } from './cache.js';
import { parseLrc, spreadPlain, toVtt } from './lrc.js';

const UA = 'stremio-musique-paroles/0.1 (https://github.com/Wallacecleaver)';
const DAY = 86400;

async function lrclib({ artist, title, duration }) {
  const get = new URL('https://lrclib.net/api/get');
  get.search = new URLSearchParams({ artist_name: artist, track_name: title, ...(duration && { duration: Math.round(duration) }) });
  let res = await fetch(get, { headers: { 'User-Agent': UA } });
  let hit = res.ok ? await res.json() : null;

  if (!hit) { // recherche plus tolérante
    const search = new URL('https://lrclib.net/api/search');
    search.search = new URLSearchParams({ artist_name: artist, track_name: title });
    res = await fetch(search, { headers: { 'User-Agent': UA } });
    const list = res.ok ? await res.json() : [];
    hit = list
      .filter((r) => !duration || !r.duration || Math.abs(r.duration - duration) <= 5)
      .sort((a, b) => Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics))[0] ?? null;
  }
  if (!hit || hit.instrumental) return null;
  if (hit.syncedLyrics) return { source: 'lrclib', synced: true, lines: parseLrc(hit.syncedLyrics) };
  if (hit.plainLyrics) return { source: 'lrclib', synced: false, lines: spreadPlain(hit.plainLyrics, duration) };
  return null;
}

async function genius({ artist, title, duration }) {
  const token = process.env.GENIUS_TOKEN;
  if (!token || !duration) return null;
  const q = new URLSearchParams({ q: `${artist} ${title}` });
  const s = await fetch(`https://api.genius.com/search?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!s.ok) return null;
  const url = (await s.json()).response?.hits?.find((h) => h.type === 'song')?.result?.url;
  if (!url) return null;

  const page = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!page.ok) return null;
  const $ = cheerio.load(await page.text());
  const blocks = $('[data-lyrics-container="true"]');
  if (!blocks.length) return null;
  blocks.find('br').replaceWith('\n');
  const plain = blocks.map((_, el) => $(el).text()).get().join('\n');
  const lines = spreadPlain(plain, duration);
  return lines.length ? { source: 'genius', synced: false, lines } : null;
}

/** Renvoie le WebVTT des paroles (LRCLIB synchro > LRCLIB brut > Genius), ou null. */
export function getLyricsVtt(videoId, track) {
  return cached(`vtt:${videoId}`, 30 * DAY, async () => {
    for (const provider of [lrclib, genius]) {
      try {
        const r = await provider(track);
        if (r?.lines.length) return toVtt(r.lines, track.duration, 10, `source=${r.source} synced=${r.synced}`);
      } catch (e) {
        console.warn(`[lyrics] ${provider.name} a échoué pour ${videoId}:`, e.message);
      }
    }
    return null;
  });
}
