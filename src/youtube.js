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

const toTrack = (i) => ({
  id: i.id,
  title: i.title,
  artist: i.artists?.map((a) => a.name).join(', ') || i.author?.name || '',
  album: i.album?.name,
  duration: i.duration?.seconds,
  poster: i.thumbnails?.at(-1)?.url,
});

export async function searchTracks(query) {
  const res = await (await yt()).music.search(query, { type: 'song' });
  const tracks = (res.songs?.contents ?? []).filter((i) => i.id).slice(0, 25).map(toTrack);
  await Promise.all(tracks.map((t) => put(`track:${t.id}`, t, 30 * 86400)));
  return tracks;
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

/** URL audio directe (liée à l'IP du serveur -> à relayer via /audio/:id). */
export async function getAudioFormat(id) {
  const c = await yt();
  const info = await c.getBasicInfo(id);
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  const url = format.url ?? (await format.decipher(c.session.player));
  return { url, mime: format.mime_type?.split(';')[0] ?? 'audio/mp4' };
}
