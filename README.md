# Musique & Paroles — addon Stremio

Cherche une musique (YouTube Music), la lit avec son **clip** ou sa **version audio**, affiche les
**paroles synchronisées** en sous-titres, et transforme tes **playlists Spotify** en catalogues.

Ouvre `https://<ton-projet>.vercel.app/` : page d'installation, configuration, test d'un titre et état du service.

## Fonctionnement

| Élément | Rôle |
|---|---|
| Catalogue « Musique » | Recherche YouTube Music (`youtubei.js`, sans clé API), pochettes en haute définition |
| Une rangée par playlist | Playlist Spotify publique → titres associés à leur équivalent YouTube Music (pagination par 40) |
| Flux | 🎬 Clip (si trouvé : titre, artiste et durée vérifiés) · 🎵 Version audio · 📡 Relais serveur (option) |
| Paroles | LRCLIB (synchro) → LRCLIB (texte brut) → Genius, servies en WebVTT sur `/lyrics/:id.vtt` |
| `/api/status` `/api/test` `/api/playlist` | Diagnostic, test d'un titre, lecture d'une playlist |

La configuration (type, playlists) est portée par l'URL : `https://host/<config>/manifest.json`.
Aucune base de données ni compte : réinstalle l'addon après avoir modifié sa configuration.

## Playlists Spotify

Lecture via la page publique d'intégration de Spotify (métadonnées seulement : titre, artiste, durée).
Pourquoi pas l'API officielle : depuis février 2026, le contenu d'une playlist n'est renvoyé que pour
ses propriétaires/collaborateurs, et le mode développeur impose Premium et un plafond d'utilisateurs.
Limites : playlists **publiques**, 100 premiers titres, et la méthode peut casser si Spotify change sa page.

## Lancer

```bash
npm install
npm start      # http://localhost:7000/
npm test
```

## Déployer sur Vercel

Importer le dépôt (preset **Other**), puis variables facultatives :
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_URL` / `KV_REST_API_TOKEN`) — cache persistant,
**recommandé** (affichage plus rapide des fiches et playlists) ;
`GENIUS_TOKEN` — paroles de secours ; `AUDIO_RELAY=on` — flux « Relais » (VPS uniquement, YouTube bloque les IP de Vercel).
