# Musique & Paroles — addon Stremio

Recherche une musique sur YouTube Music, la lit dans Stremio et affiche les paroles
**synchronisées** sous forme de sous-titres.

## Fonctionnement

| Ressource | Rôle |
|---|---|
| `catalog` (search) | Recherche YouTube Music (`youtubei.js`, sans clé API) |
| `meta` | Titre, artiste, pochette, durée |
| `stream` | Audio relayé par `/audio/:id` (Range géré) + sous-titres attachés |
| `subtitles` | Même piste de paroles, pour les clients qui passent par la ressource |
| `/lyrics/:id.vtt` | LRCLIB (synchro) → LRCLIB (texte brut) → Genius, converti en WebVTT |

Paroles **sans timestamp** (texte brut, Genius) : lignes réparties sur la durée au prorata
de leur longueur. C'est approximatif ; seules les paroles LRCLIB sont réellement synchronisées.

## Lancer

```bash
npm install
cp .env.example .env   # optionnel
npm start              # http://localhost:7000/manifest.json
npm test
```

## Déploiement Vercel

1. Importer le dépôt sur Vercel (aucun réglage de build : `api/index.js` + `vercel.json` suffisent).
2. Variables d'environnement (toutes optionnelles) :
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_URL` / `KV_REST_API_TOKEN` si Redis vient de l'intégration Vercel) : cache persistant des paroles.
   - `GENIUS_TOKEN` : fallback paroles non synchronisées.
   - `STREAM_MODE` : `proxy` (défaut) ou `ytid`.
3. Installer `https://<ton-projet>.vercel.app/manifest.json` dans Stremio.

L'URL publique est déduite de la requête (previews comprises) ; `BASE_URL` n'est utile que derrière un domaine custom exotique.
Limite : une fonction Vercel a une durée maximale (`maxDuration`, 60 s ici) ; le relais audio peut donc être coupé sur un très long titre.

## À tester en premier

1. **Lecture audio via `/audio/:id`** : l'URL googlevideo est liée à l'IP du serveur, donc relayée.
   Les IP de datacenter (Vercel) sont parfois bloquées par YouTube : si ça échoue,
   héberge l'addon sur ton VPS (`npm start` derrière Cloudflare).
2. **`STREAM_MODE=ytid`** : lecteur YouTube intégré de Stremio. Plus simple, mais les
   sous-titres peuvent ne pas s'afficher.
3. Le relais audio consomme de la bande passante du serveur.
