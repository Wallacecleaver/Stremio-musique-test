/** Configuration d'un utilisateur, portée par l'URL de l'addon : /<config>/manifest.json */
export const MAX_PLAYLISTS = 10;
export const DEFAULTS = Object.freeze({ type: 'music', playlists: [] });
const TYPES = new Set(['music', 'movie']);

export function sanitize(raw) {
  const type = TYPES.has(raw?.type) ? raw.type : DEFAULTS.type;
  const seen = new Set();
  const playlists = [];
  for (const p of Array.isArray(raw?.playlists) ? raw.playlists : []) {
    const id = typeof p?.id === 'string' && /^[A-Za-z0-9]{10,30}$/.test(p.id) ? p.id : null;
    if (!id || seen.has(id) || playlists.length >= MAX_PLAYLISTS) continue;
    seen.add(id);
    playlists.push({ id, name: String(p.name || 'Playlist').slice(0, 60) });
  }
  return { type, playlists };
}

export const encodeConfig = (cfg) => Buffer.from(JSON.stringify(sanitize(cfg))).toString('base64url');

/** Décode sans jamais lever : renvoie null si ce n'est pas une configuration valide. */
export function decodeConfig(str) {
  if (!str || !/^[A-Za-z0-9_-]{8,4000}$/.test(str)) return null;
  try {
    const raw = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    return raw && typeof raw === 'object' ? sanitize(raw) : null;
  } catch {
    return null;
  }
}
