import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const mem = new Map(); // key -> { value, exp }
const MISS = '__miss__';

async function read(key) {
  try {
    if (redis) return await redis.get(key);
    const e = mem.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) { mem.delete(key); return null; }
    return e.value;
  } catch {
    return null;
  }
}

async function write(key, value, ttl) {
  try {
    if (redis) await redis.set(key, value, { ex: ttl });
    else mem.set(key, { value, exp: Date.now() + ttl * 1000 });
  } catch { /* le cache ne doit jamais casser une requête */ }
}

export const get = read;
export const put = write;

/** Lit le cache ou appelle loader(). Les échecs (null) sont mémorisés 1 h max. */
export async function cached(key, ttl, loader) {
  const hit = await read(key);
  if (hit === MISS) return null;
  if (hit != null) return hit;
  const value = await loader();
  await write(key, value ?? MISS, value == null ? Math.min(ttl, 3600) : ttl);
  return value;
}
