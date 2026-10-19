import sdk from 'stremio-addon-sdk';
import { searchTracks, getTrack, findClip } from './youtube.js';
import { baseUrl } from './context.js';

const { addonBuilder } = sdk;

export const manifest = {
  id: 'community.wallace.musique-paroles',
  version: '0.1.0',
  name: 'Musique & Paroles',
  description: 'Cherche une musique sur YouTube Music et affiche les paroles synchronisées (LRCLIB, Genius en secours).',
  resources: ['catalog', 'meta', 'stream', 'subtitles'],
  types: ['movie'],
  idPrefixes: ['yt:'],
  catalogs: [{ type: 'movie', id: 'musique', name: 'Musique', extra: [{ name: 'search', isRequired: true }] }],
  behaviorHints: { configurable: false },
};

const builder = new addonBuilder(manifest);
const videoId = (id) => id.replace(/^yt:/, '');
const subtitleFor = (id) => ({ id: 'paroles', url: `${baseUrl()}/lyrics/${id}.vtt`, lang: 'fra' });

builder.defineCatalogHandler(async ({ extra }) => {
  if (!extra?.search) return { metas: [] };
  const tracks = await searchTracks(extra.search);
  return {
    metas: tracks.map((t) => ({
      id: `yt:${t.id}`,
      type: 'movie',
      name: t.title,
      poster: t.poster,
      posterShape: 'square',
      description: t.artist,
    })),
  };
});

builder.defineMetaHandler(async ({ id }) => {
  const t = await getTrack(videoId(id));
  if (!t) return { meta: null };
  return {
    meta: {
      id,
      type: 'movie',
      name: t.title,
      poster: t.poster,
      posterShape: 'square',
      background: t.poster,
      description: [t.artist, t.album].filter(Boolean).join(' · '),
      runtime: t.duration ? `${Math.round(t.duration / 60)} min` : undefined,
    },
  };
});

/**
 * Flux proposés (l'utilisateur choisit dans Stremio) :
 *  1. Clip vidéo YouTube, si on en trouve un  (lu depuis l'IP de l'utilisateur)
 *  2. Version audio YouTube                   (idem)
 *  3. Audio relayé par le serveur             (seulement si AUDIO_RELAY=on : inutile sur Vercel, YouTube bloque l'IP)
 */
builder.defineStreamHandler(async ({ id }) => {
  const vid = videoId(id);
  const subtitles = [subtitleFor(vid)];
  const streams = [];

  const track = await getTrack(vid).catch(() => null);
  const clip = track ? await findClip(track).catch(() => null) : null;
  if (clip) streams.push({ ytId: clip, name: 'Clip', title: 'Clip vidéo (YouTube)', subtitles });
  streams.push({ ytId: vid, name: 'Audio', title: 'Version audio (YouTube)', subtitles });
  if (process.env.AUDIO_RELAY === 'on') {
    streams.push({ url: `${baseUrl()}/audio/${vid}`, name: 'Relais', title: 'Audio relayé par le serveur', subtitles });
  }
  return { streams };
});

builder.defineSubtitlesHandler(async ({ id }) => ({ subtitles: [subtitleFor(videoId(id))] }));

export const addonInterface = builder.getInterface();
