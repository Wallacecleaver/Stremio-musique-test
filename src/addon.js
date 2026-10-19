import sdk from 'stremio-addon-sdk';
import { searchTracks, getTrack, findClip } from './youtube.js';
import { fetchPlaylist } from './spotify.js';
import { resolveTrack, mapLimit, encodeQuery, decodeQuery } from './resolve.js';
import { baseUrl } from './context.js';
import { DEFAULTS, decodeConfig } from './config.js';

const { addonBuilder, getRouter } = sdk;
const PAGE = 40;

export function buildManifest(cfg = DEFAULTS) {
  const type = cfg.type;
  return {
    id: 'community.wallace.musique-paroles',
    version: '0.3.0',
    name: 'Musique & Paroles',
    description: 'Cherche une musique, lis-la avec son clip et ses paroles synchronisées, et transforme tes playlists Spotify en catalogues.',
    logo: undefined, // renseigné par app.js (URL absolue)
    resources: ['catalog', 'meta', 'stream', 'subtitles'],
    types: [type],
    idPrefixes: ['yt:', 'ytq:'],
    catalogs: [
      { type, id: 'search', name: 'Musique', extra: [{ name: 'search', isRequired: true }] },
      ...cfg.playlists.map((p) => ({ type, id: `pl:${p.id}`, name: p.name, extra: [{ name: 'skip' }] })),
    ],
    behaviorHints: { configurable: true, configurationRequired: false },
  };
}

const mainArtist = (a = '') => a.split(/,\s*/)[0];
const label = (t) => `${t.title} – ${mainArtist(t.artist)}`;

/** videoId YouTube d'un id Stremio (`yt:XXX`, ou `ytq:` à résoudre à la demande). */
async function toVideoId(id) {
  if (id.startsWith('yt:')) return id.slice(3);
  if (id.startsWith('ytq:')) {
    const q = decodeQuery(id);
    return (q && (await resolveTrack(q))?.id) || null;
  }
  return null;
}

const subtitleFor = (vid) => ({ id: 'paroles', url: `${baseUrl()}/lyrics/${vid}.vtt`, lang: 'fra' });

export function createInterface(cfg = DEFAULTS, logoUrl) {
  const type = cfg.type;
  const manifest = { ...buildManifest(cfg), ...(logoUrl && { logo: logoUrl, background: logoUrl }) };
  const builder = new addonBuilder(manifest);

  const meta = (t, id = `yt:${t.id}`) => ({
    id,
    type,
    name: label(t),
    poster: t.poster,
    posterShape: 'square',
    description: [t.artist, t.album].filter(Boolean).join(' · '),
  });

  builder.defineCatalogHandler(async ({ id, extra }) => {
    if (id === 'search') {
      if (!extra?.search) return { metas: [] };
      return { metas: (await searchTracks(extra.search)).map((t) => meta(t)) };
    }
    if (id.startsWith('pl:')) {
      const pl = await fetchPlaylist(id.slice(3));
      const skip = Number(extra?.skip) || 0;
      const page = pl.tracks.slice(skip, skip + PAGE);
      const resolved = await mapLimit(page, 8, resolveTrack);
      // Un titre non résolu garde sa place (id « à résoudre ») pour que la pagination reste exacte.
      return {
        metas: page.map((t, i) => (resolved[i] ? meta(resolved[i]) : meta({ ...t, poster: pl.cover }, encodeQuery(t)))),
      };
    }
    return { metas: [] };
  });

  builder.defineMetaHandler(async ({ id }) => {
    const vid = await toVideoId(id);
    const t = vid ? await getTrack(vid) : null;
    if (t) {
      return {
        meta: {
          ...meta(t, id),
          background: t.poster,
          runtime: t.duration ? `${Math.max(1, Math.round(t.duration / 60))} min` : undefined,
          behaviorHints: { defaultVideoId: id },
        },
      };
    }
    const q = id.startsWith('ytq:') ? decodeQuery(id) : null;
    return { meta: q ? { ...meta(q, id), behaviorHints: { defaultVideoId: id } } : null };
  });

  /**
   * Flux proposés : clip (si trouvé) puis version audio, lus par Stremio depuis l'IP de l'utilisateur.
   * Le relais serveur (AUDIO_RELAY=on) est réservé à un VPS : YouTube bloque les IP de Vercel.
   */
  builder.defineStreamHandler(async ({ id }) => {
    const vid = await toVideoId(id);
    if (!vid) return { streams: [] };
    const subtitles = [subtitleFor(vid)];
    const track = await getTrack(vid).catch(() => null);
    const who = track ? label(track) : '';
    const clip = track ? await findClip(track).catch(() => null) : null;
    const streams = [];
    if (clip) streams.push({ ytId: clip, name: '🎬 Clip', title: ['Clip vidéo', who].filter(Boolean).join('\n'), subtitles });
    streams.push({ ytId: vid, name: '🎵 Audio', title: ['Version audio', who].filter(Boolean).join('\n'), subtitles });
    if (process.env.AUDIO_RELAY === 'on') {
      streams.push({ url: `${baseUrl()}/audio/${vid}`, name: '📡 Relais', title: ['Audio via le serveur', who].filter(Boolean).join('\n'), subtitles });
    }
    return { streams };
  });

  builder.defineSubtitlesHandler(async ({ id }) => {
    const vid = await toVideoId(id);
    return { subtitles: vid ? [subtitleFor(vid)] : [] };
  });

  return builder.getInterface();
}

// Un routeur SDK par configuration, mis en cache (les configs sont portées par l'URL).
const routers = new Map();
export function routerFor(cfgStr, logoUrl) {
  const key = `${cfgStr ?? ''}|${logoUrl ?? ''}`;
  if (routers.has(key)) return routers.get(key);
  const cfg = cfgStr ? decodeConfig(cfgStr) : DEFAULTS;
  if (!cfg) return null;
  const router = getRouter(createInterface(cfg, logoUrl));
  if (routers.size >= 100) routers.delete(routers.keys().next().value);
  routers.set(key, router);
  return router;
}
