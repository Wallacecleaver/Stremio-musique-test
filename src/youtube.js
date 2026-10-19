import { Innertube } from 'youtubei.js';
import { cached, put } from './cache.js';

let client;
export const yt = async () => (client ??= await Innertube.create());

const NOISE = /\s*[(\[](?:[^)\]]*(?:official|video|audio|lyrics?|paroles|clip|visuali[sz]er|hd|hq|4k|remaster)[^)\]]*)[)\]]/gi;

/** "Artiste - Titre (Official Video)" -> { artist, title } */
export function cleanTrack(rawTitle = '', rawAuthor = '') {
  let artist = rawAuthor.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  let title = rawTitle.replace(NOISE, '').trim();
  const split = title.split(/\s[-–—]\s/);
  if (split.length >= 2) {
    artist = split[0].trim();
    title = split.slice(1).join(' - ').trim();
  }
  return { artist, title };
}

/** Agrandit les pochettes googleusercontent (=w226-h226 -> 600 px) pour un affichage net. */
export function bigThumb(url) {
  if (!url) return url;
  return url.replace(/=w\d+-h\d+[^/?]*$/, '=w600-h600-l90-rj').replace(/=s\d+[^/?]*$/, '=s600');
}

export const toTrack = (i) => ({
  id: i.id,
  title: i.title,
  artist: i.artists?.map((a) => a.name).join(', ') || i.author?.name || '',
  album: i.album?.name,
  duration: i.duration?.seconds,
  poster: bigThumb(i.thumbnails?.at(-1)?.url),
});

/** Éléments d'une recherche YT Music : l'étagère nommée si elle existe, sinon toutes les étagères (cas des recherches filtrées). */
export const shelfItems = (res, key) => res[key]?.contents ?? res.contents?.flatMap((s) => s.contents ?? []) ?? [];

export async function searchTracks(query) {
  const res = await (await yt()).music.search(query, { type: 'song' });
  const tracks = shelfItems(res, 'songs')
    .filter((i) => i.id && (!i.item_type || i.item_type === 'song'))
    .slice(0, 25)
    .map(toTrack);
  await Promise.all(tracks.map((t) => put(`track:${t.id}`, t, 30 * 86400)));
  return tracks;
}

const norm = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const VARIANT = /\b(live|cover|karaoke|remix|reaction|instrumental|slowed|reverb|sped|nightcore|8d)\b/;

/** Le candidat est-il le même morceau (en clip) que `track` ? Titre, artiste et durée doivent concorder. */
export function isSameTrack(track, cand) {
  if (!cand?.id || cand.id === track.id) return false;
  const t = norm(track.title);
  const c = norm(cand.title);
  if (!t || !(c.includes(t) || t.includes(c))) return false;
  if (VARIANT.test(c) && !VARIANT.test(t)) return false;
  const a = norm(track.artist).split(' ')[0];
  if (a && !norm(`${cand.artist} ${cand.title}`).includes(a)) return false;
  if (track.duration && cand.duration && Math.abs(track.duration - cand.duration) > Math.max(15, track.duration * 0.1)) return false;
  return true;
}

/** videoId d'un clip officiel correspondant au titre, ou null (la version « song » est souvent juste une pochette). */
export function findClip(track) {
  return cached(`clip:${track.id}`, 30 * 86400, async () => {
    const res = await (await yt()).music.search(`${track.artist} ${track.title}`, { type: 'video' });
    const cands = shelfItems(res, 'videos').filter((i) => i.id).map(toTrack);
    const hit = cands.find((c) => isSameTrack(track, c));
    if (!hit) console.warn(`[clip] aucun clip pour "${track.artist} - ${track.title}" (${cands.length} candidats : ${cands.slice(0, 3).map((c) => `${c.title}/${c.duration}s`).join(' ; ')})`);
    return hit?.id ?? null;
  });
}

/** Métadonnées propres d'un titre : cache de recherche, sinon infos de la vidéo. */
export function getTrack(id) {
  return cached(`track:${id}`, 30 * 86400, async () => {
    const info = await (await yt()).getBasicInfo(id);
    const b = info.basic_info;
    const { artist, title } = cleanTrack(b.title, b.author);
    return { id, title, artist, duration: b.duration, poster: b.thumbnail?.at(-1)?.url };
  });
}

// Clients InnerTube essayés dans l'ordre : YouTube refuse le client « web » sans jeton PO,
// les autres fournissent souvent des liens audio directement.
const AUDIO_CLIENTS = ['ANDROID_VR', 'TV', 'IOS', 'YTMUSIC_ANDROID', 'TV_SIMPLY', 'WEB_EMBEDDED', 'MWEB', 'ANDROID'];
let lastGood;

/** Essaie chaque candidat jusqu'à un succès ; si tout échoue, l'erreur liste chaque échec (visible dans les logs). */
export async function firstWorking(candidates, attempt) {
  const errors = [];
  for (const c of candidates) {
    try {
      const out = await attempt(c);
      if (out) return { value: out, candidate: c };
      errors.push(`${c}: résultat vide`);
    } catch (e) {
      errors.push(`${c}: ${e.message}`);
    }
  }
  throw new Error(`Aucun client YouTube n'a fourni d'audio -> ${errors.join(' | ')}`);
}

/** URL audio directe (liée à l'IP du serveur -> à relayer via /audio/:id). */
export async function getAudioFormat(id) {
  const c = await yt();
  const order = lastGood ? [lastGood, ...AUDIO_CLIENTS.filter((x) => x !== lastGood)] : AUDIO_CLIENTS;
  const { value, candidate } = await firstWorking(order, async (client) => {
    const info = await c.getBasicInfo(id, { client });
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });
    const url = format.url || (await format.decipher(c.session.player));
    return url ? { url, mime: format.mime_type?.split(';')[0] ?? 'audio/mp4' } : null;
  });
  lastGood = candidate;
  return value;
}
