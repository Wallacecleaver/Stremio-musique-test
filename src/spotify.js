import { cached } from './cache.js';

/**
 * Lecture des playlists Spotify PUBLIQUES via la page d'intégration (embed), sans clé ni connexion.
 * Pourquoi pas l'API officielle : depuis février 2026, le contenu d'une playlist n'est renvoyé que pour
 * les playlists dont l'utilisateur est propriétaire/collaborateur, et le mode développeur est très limité.
 * Cette méthode n'est pas une API officielle : elle peut cesser de fonctionner si Spotify change sa page.
 * Seules des métadonnées (titre, artiste, durée) sont lues ; aucun audio.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export function parsePlaylistId(input = '') {
  const s = String(input).trim();
  const m = s.match(/playlist[/:]([A-Za-z0-9]{10,30})/) ?? s.match(/^([A-Za-z0-9]{22})$/);
  return m?.[1] ?? null;
}

function find(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 12) return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const r = find(v, key, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** HTML de la page embed -> { name, owner, cover, tracks[] } (parsing tolérant : cherche les clés où qu'elles soient). */
export function parseEmbed(html) {
  const raw = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new Error('page Spotify inattendue (pas de données)');
  const data = JSON.parse(raw);
  const list = find(data, 'trackList');
  if (!Array.isArray(list)) throw new Error('playlist introuvable, privée ou format Spotify modifié');
  const clean = (s = '') => String(s).replace(/\u00a0/g, ' ').trim();
  const tracks = list
    .filter((t) => t?.title && t.isPlayable !== false)
    .map((t) => ({
      title: clean(t.title),
      artist: clean(t.subtitle).split(/,\s*/)[0],
      artists: clean(t.subtitle),
      duration: t.duration ? Math.round(t.duration / 1000) : undefined,
    }));
  const cover = find(data, 'coverArt')?.sources ?? [];
  return {
    name: clean(find(data, 'name') || find(data, 'title') || 'Playlist'),
    owner: clean(find(data, 'subtitle') || ''),
    cover: cover.at(-1)?.url ?? null,
    tracks,
  };
}

export function fetchPlaylist(id) {
  return cached(`spl:${id}`, 3600, async () => {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'fr,en;q=0.8' },
    });
    if (!res.ok) throw new Error(`Spotify a répondu ${res.status}`);
    return { id, ...parseEmbed(await res.text()) };
  });
}
