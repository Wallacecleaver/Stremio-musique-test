/** Parse un LRC ("[mm:ss.xx] texte") en [{ t, text }] triés. Gère plusieurs timestamps par ligne. */
export function parseLrc(lrc) {
  const out = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Paroles brutes -> lignes datées, réparties sur la durée au prorata de la longueur (approximatif). */
export function spreadPlain(plain, duration) {
  const lines = plain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\[.*\]$/.test(l)); // retire [Couplet 1], [Refrain]…
  if (!lines.length || !duration) return [];
  const lead = Math.min(8, duration * 0.05); // petit blanc avant le 1er vers
  const usable = duration - lead - Math.min(6, duration * 0.04);
  const weights = lines.map((l) => Math.max(l.length, 8));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = lead;
  return lines.map((text, i) => {
    const line = { t, text };
    t += (weights[i] / total) * usable;
    return line;
  });
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
export function vttTime(sec) {
  const ms = Math.round(sec * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}

/** Lignes datées -> WebVTT. Une ligne reste affichée jusqu'à la suivante (max maxHold s). */
export function toVtt(lines, duration, maxHold = 10) {
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    const { t, text } = lines[i];
    if (!text) continue; // ligne vide = pause instrumentale
    const next = lines[i + 1]?.t ?? (duration || t + 5);
    const end = Math.min(next, t + maxHold);
    if (end - t < 0.3) continue;
    cues.push(`${vttTime(t)} --> ${vttTime(end)}\n${text}`);
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
