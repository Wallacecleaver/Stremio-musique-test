import { cached, put } from './cache.js';
import { yt, toTrack, shelfItems, isSameTrack } from './youtube.js';

const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const key = (t) => `res:${norm(t.artist)}|${norm(t.title)}`;

/** Identifiant "à résoudre" : on garde titre/artiste/durée dans l'id, sans dépendre d'aucun cache. */
export const encodeQuery = (t) =>
  'ytq:' + Buffer.from(JSON.stringify({ t: t.title, a: t.artist, d: t.duration })).toString('base64url');
export function decodeQuery(id) {
  try {
    const o = JSON.parse(Buffer.from(id.replace(/^ytq:/, ''), 'base64url').toString('utf8'));
    return o?.t ? { title: o.t, artist: o.a ?? '', duration: o.d } : null;
  } catch {
    return null;
  }
}

/** Titre Spotify {title, artist, duration} -> morceau YouTube Music équivalent (ou null). Mémorisé 30 j. */
export function resolveTrack(t) {
  return cached(key(t), 30 * 86400, async () => {
    const res = await (await yt()).music.search(`${t.artist} ${t.title}`, { type: 'song' });
    const hit = shelfItems(res, 'songs').filter((i) => i.id).map(toTrack).find((c) => isSameTrack(t, c));
    if (!hit) return null;
    // On garde les métadonnées Spotify (plus fiables pour LRCLIB) avec la pochette YouTube.
    const track = { id: hit.id, title: t.title, artist: t.artist, album: hit.album, duration: t.duration ?? hit.duration, poster: hit.poster };
    await put(`track:${hit.id}`, track, 30 * 86400);
    return track;
  });
}

/** Exécute fn sur items avec au plus `limit` appels simultanés, dans l'ordre, avec un budget de temps global. */
export async function mapLimit(items, limit, fn, budgetMs = 15000) {
  const deadline = Date.now() + budgetMs;
  const out = new Array(items.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length && Date.now() < deadline) {
        const i = next++;
        out[i] = await fn(items[i]).catch(() => null);
      }
    }),
  );
  return out;
}
