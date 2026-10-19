import sdk from 'stremio-addon-sdk';
import { searchTracks, getTrack } from './youtube.js';
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

builder.defineStreamHandler(async ({ id }) => {
  const vid = videoId(id);
  const stream =
    process.env.STREAM_MODE === 'ytid'
      ? { ytId: vid, title: 'YouTube (lecteur intégré)' }
      : { url: `${baseUrl()}/audio/${vid}`, title: 'Audio', behaviorHints: { notWebReady: false } };
  return { streams: [{ ...stream, subtitles: [subtitleFor(vid)] }] };
});

builder.defineSubtitlesHandler(async ({ id }) => ({ subtitles: [subtitleFor(videoId(id))] }));

export const addonInterface = builder.getInterface();
