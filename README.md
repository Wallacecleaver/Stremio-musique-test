# Musique & Paroles — addon Stremio

Recherche une musique sur YouTube Music, la lit dans Stremio et affiche les paroles
**synchronisées** sous forme de sous-titres.

## Fonctionnement

| Ressource | Rôle |
|---|---|
| `catalog` (search) | Recherche YouTube Music (`youtubei.js`, sans clé API) |
| `meta` | Titre, artiste, pochette, durée |
| `stream` | Clip YouTube (si trouvé) + version audio YouTube ; relais `/audio/:id` en option (`AUDIO_RELAY=on`) ; sous-titres attachés |
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

## Flux proposés

Stremio liste jusqu'à trois flux, à choisir dans l'écran du titre :

1. **Clip** : clip YouTube correspondant (titre, artiste et durée vérifiés), s'il existe.
2. **Audio** : la version « song » de YouTube Music (souvent juste la pochette).
3. **Relais** : audio extrait et relayé par le serveur. Désactivé par défaut ; `AUDIO_RELAY=on`
   sur un VPS uniquement, car YouTube refuse les IP de Vercel (« Streaming data not available »).

Les flux 1 et 2 sont lus par Stremio directement depuis ton PC, donc ils ne dépendent pas de l'IP du serveur.
Point à vérifier : les sous-titres (paroles) s'affichent-ils avec un flux YouTube ? Sinon, héberger sur un VPS avec le relais.
