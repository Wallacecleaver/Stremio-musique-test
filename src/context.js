import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

/** Middleware : mémorise l'URL publique de l'addon pour les handlers du SDK (qui n'ont pas `req`). */
export function withBaseUrl(req, _res, next) {
  const proto = req.headers['x-forwarded-proto']?.split(',')[0] ?? req.protocol;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  als.run({ base: (process.env.BASE_URL || `${proto}://${host}`).replace(/\/$/, '') }, next);
}

export const baseUrl = () => als.getStore()?.base ?? process.env.BASE_URL ?? 'http://localhost:7000';
