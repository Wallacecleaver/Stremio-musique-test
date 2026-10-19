/** Page unique : installation, configuration (playlists Spotify), test d'un titre et état du service. */
export function page({ origin }) {
  return HTML.replace('__ORIGIN__', origin);
}

const HTML = String.raw`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Musique & Paroles — addon Stremio</title>
<link rel="icon" href="/logo.png">
<style>
:root{--bg:#0b0b12;--card:#14141f;--line:#262636;--text:#ececf4;--mute:#9a9ab0;--accent:#7c6cf6;--accent2:#ec4899;--ok:#34d399;--warn:#fbbf24;--bad:#f87171}
@media (prefers-color-scheme:light){:root{--bg:#f5f5fa;--card:#fff;--line:#e3e3ee;--text:#16161f;--mute:#6b6b80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:880px;margin:0 auto;padding:28px 18px 80px}
header{display:flex;align-items:center;gap:14px;margin-bottom:26px}
header img{width:52px;height:52px;border-radius:14px}
h1{font-size:22px;margin:0}header p{margin:0;color:var(--mute)}
.pill{margin-left:auto;padding:5px 12px;border-radius:99px;font-size:13px;border:1px solid var(--line);color:var(--mute);white-space:nowrap}
.pill.ok{color:var(--ok);border-color:var(--ok)}.pill.bad{color:var(--bad);border-color:var(--bad)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px}
.card h2{font-size:16px;margin:0 0 4px}.card .sub{color:var(--mute);margin:0 0 14px;font-size:13.5px}
.row{display:flex;gap:10px;flex-wrap:wrap}
input[type=text]{flex:1;min-width:200px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px 13px;font:inherit}
input:focus{outline:2px solid var(--accent);border-color:transparent}
button,.btn{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:11px 16px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
button.ghost,.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
button:disabled{opacity:.55;cursor:default}
.big{padding:14px 22px;font-size:16px;background:linear-gradient(135deg,var(--accent),var(--accent2))}
.url{margin-top:12px;font:12.5px ui-monospace,Consolas,monospace;color:var(--mute);word-break:break-all;background:var(--bg);border:1px dashed var(--line);border-radius:10px;padding:10px 12px}
.pl{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}
.pl:first-of-type{border-top:0}
.pl img,.ph{width:46px;height:46px;border-radius:8px;object-fit:cover;background:var(--line);flex:none}
.pl .t{font-weight:600}.pl .m{color:var(--mute);font-size:13px}.pl button{margin-left:auto;padding:7px 11px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.seg button{background:transparent;color:var(--mute);border-radius:0;font-weight:500}
.seg button.on{background:var(--accent);color:#fff}
.msg{margin-top:10px;font-size:13.5px;color:var(--mute)}.msg.err{color:var(--bad)}
.chk{display:flex;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid var(--line)}
.chk:first-child{border-top:0}.dot{width:9px;height:9px;border-radius:50%;background:var(--mute);flex:none;transform:translateY(-1px)}
.dot.ok{background:var(--ok)}.dot.warn{background:var(--warn)}.dot.bad{background:var(--bad)}
.chk .d{color:var(--mute);margin-left:auto;text-align:right;font-size:13px}
.res{display:flex;gap:14px;margin-top:14px}.res img{width:96px;height:96px;border-radius:10px;object-fit:cover;flex:none}
.res ul{margin:6px 0 0;padding-left:18px;color:var(--mute);font-size:13.5px}
.tag{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;border:1px solid var(--line);color:var(--mute);margin-right:6px}
.tag.ok{color:var(--ok);border-color:var(--ok)}.tag.no{color:var(--bad);border-color:var(--bad)}
a{color:var(--accent)}
details{margin-top:10px;color:var(--mute);font-size:13.5px}summary{cursor:pointer}
</style>
</head>
<body>
<main>
<header>
  <img src="/logo.png" alt="">
  <div><h1>Musique &amp; Paroles</h1><p>Clip, audio et paroles synchronisées dans Stremio</p></div>
  <span id="pill" class="pill">vérification…</span>
</header>

<section class="card">
  <h2>1. Installer</h2>
  <p class="sub">Le lien contient ta configuration : réinstalle l'addon après chaque modification.</p>
  <div class="row">
    <a id="install" class="btn big" href="#">Installer dans Stremio</a>
    <button id="copy" class="ghost" type="button">Copier le lien</button>
  </div>
  <div id="url" class="url"></div>
</section>

<section class="card">
  <h2>2. Playlists Spotify</h2>
  <p class="sub">Colle le lien d'une playlist <b>publique</b> : elle devient une rangée de ton catalogue Stremio (jusqu'à 10).</p>
  <div class="row">
    <input id="plurl" type="text" placeholder="https://open.spotify.com/playlist/…" autocomplete="off">
    <button id="pladd" type="button">Ajouter</button>
  </div>
  <div id="plmsg" class="msg"></div>
  <div id="pls"></div>
  <details><summary>Limites</summary>
    <p>Playlists publiques uniquement (pas « Titres likés », pas les playlists privées). Les 100 premiers titres sont lus.
    La lecture passe par la page publique d'intégration de Spotify, ce n'est pas une API officielle : elle peut cesser de marcher si Spotify la modifie.
    Seules les métadonnées (titre, artiste, durée) sont lues ; la musique vient de YouTube.</p>
  </details>
</section>

<section class="card">
  <h2>3. Affichage</h2>
  <p class="sub">Type de contenu déclaré à Stremio.</p>
  <div class="seg" id="seg">
    <button type="button" data-type="music">Musique (recommandé)</button>
    <button type="button" data-type="movie">Film (compatibilité)</button>
  </div>
  <p class="msg">« Musique » donne une rangée propre ; si ton appareil Stremio n'affiche rien, passe sur « Film » et réinstalle.</p>
</section>

<section class="card">
  <h2>Tester un titre</h2>
  <p class="sub">Vérifie ce que l'addon trouve : pochette, clip et paroles.</p>
  <div class="row">
    <input id="q" type="text" placeholder="ex. Django Firmament" autocomplete="off">
    <button id="go" type="button">Tester</button>
  </div>
  <div id="out"></div>
</section>

<section class="card">
  <h2>État du service</h2>
  <p class="sub">Diagnostic en direct, depuis le serveur de l'addon.</p>
  <div id="checks">…</div>
  <button id="recheck" class="ghost" type="button" style="margin-top:12px">Relancer</button>
</section>
</main>

<script>
(function () {
  var ORIGIN = '__ORIGIN__';
  var $ = function (id) { return document.getElementById(id); };
  var cfg = { type: 'music', playlists: [] };
  var info = {};

  function b64e(o) {
    var s = btoa(unescape(encodeURIComponent(JSON.stringify(o))));
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function msg(el, text, err) { el.textContent = text || ''; el.className = 'msg' + (err ? ' err' : ''); }

  try {
    var seg = location.pathname.split('/')[1];
    if (seg && seg !== 'configure') { var c = b64d(seg); if (c) { cfg.type = c.type === 'movie' ? 'movie' : 'music'; cfg.playlists = c.playlists || []; } }
  } catch (e) {}

  function manifestPath() { return '/' + b64e(cfg) + '/manifest.json'; }
  function refresh() {
    var path = manifestPath();
    $('url').textContent = ORIGIN + path;
    $('install').href = 'stremio://' + ORIGIN.replace(/^https?:\/\//, '') + path;
    Array.prototype.forEach.call($('seg').children, function (b) { b.className = b.getAttribute('data-type') === cfg.type ? 'on' : ''; });
    var box = $('pls');
    if (!cfg.playlists.length) { box.innerHTML = '<p class="msg">Aucune playlist pour l\u2019instant. La recherche reste disponible dans Stremio.</p>'; return; }
    box.innerHTML = cfg.playlists.map(function (p, i) {
      var m = info[p.id] || {};
      var img = m.cover ? '<img src="' + esc(m.cover) + '" alt="">' : '<div class="ph"></div>';
      var meta = m.count ? m.count + ' titres' + (m.owner ? ' \u00b7 ' + esc(m.owner) : '') : 'chargement\u2026';
      return '<div class="pl">' + img + '<div><div class="t">' + esc(p.name) + '</div><div class="m">' + meta + '</div></div>' +
        '<button class="ghost" data-i="' + i + '" type="button">Retirer</button></div>';
    }).join('');
  }
  function loadInfo() {
    cfg.playlists.forEach(function (p) {
      if (info[p.id]) return;
      fetch('/api/playlist?id=' + p.id).then(function (r) { return r.json(); }).then(function (d) { if (d.id) { info[p.id] = d; refresh(); } }).catch(function () {});
    });
  }

  $('pls').addEventListener('click', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-i');
    if (i != null) { cfg.playlists.splice(Number(i), 1); refresh(); }
  });
  $('seg').addEventListener('click', function (e) {
    var t = e.target.getAttribute && e.target.getAttribute('data-type');
    if (t) { cfg.type = t; refresh(); }
  });
  $('copy').addEventListener('click', function () {
    navigator.clipboard.writeText(ORIGIN + manifestPath()).then(function () { $('copy').textContent = 'Copi\u00e9 \u2713'; setTimeout(function () { $('copy').textContent = 'Copier le lien'; }, 1600); });
  });

  function addPlaylist() {
    var v = $('plurl').value.trim();
    if (!v) return;
    if (cfg.playlists.length >= 10) return msg($('plmsg'), 'Maximum 10 playlists.', true);
    $('pladd').disabled = true; msg($('plmsg'), 'Lecture de la playlist\u2026');
    fetch('/api/playlist?url=' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) return msg($('plmsg'), d.error, true);
      if (cfg.playlists.some(function (p) { return p.id === d.id; })) return msg($('plmsg'), 'D\u00e9j\u00e0 ajout\u00e9e.', true);
      cfg.playlists.push({ id: d.id, name: d.name }); info[d.id] = d;
      $('plurl').value = ''; msg($('plmsg'), '\u00ab ' + d.name + ' \u00bb ajout\u00e9e (' + d.count + ' titres). R\u00e9installe l\u2019addon pour la voir dans Stremio.');
      refresh();
    }).catch(function () { msg($('plmsg'), 'Erreur r\u00e9seau.', true); }).then(function () { $('pladd').disabled = false; });
  }
  $('pladd').addEventListener('click', addPlaylist);
  $('plurl').addEventListener('keydown', function (e) { if (e.key === 'Enter') addPlaylist(); });

  function runTest() {
    var q = $('q').value.trim(); if (!q) return;
    $('go').disabled = true; $('out').innerHTML = '<p class="msg">Recherche\u2026</p>';
    fetch('/api/test?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) { $('out').innerHTML = '<p class="msg err">' + esc(d.error) + '</p>'; return; }
      if (!d.found) { $('out').innerHTML = '<p class="msg">Aucun r\u00e9sultat.</p>'; return; }
      var t = d.track, ly = d.lyrics;
      var lyTag = ly ? '<span class="tag ok">paroles ' + (ly.synced ? 'synchronis\u00e9es' : 'non synchronis\u00e9es') + ' (' + ly.lines + ' lignes, ' + esc(ly.source || '?') + ')</span>' : '<span class="tag no">pas de paroles</span>';
      var clip = d.clip ? '<a class="tag ok" href="' + esc(d.clip) + '" target="_blank" rel="noopener">clip trouv\u00e9</a>' : '<span class="tag no">pas de clip</span>';
      $('out').innerHTML = '<div class="res">' + (t.poster ? '<img src="' + esc(t.poster) + '" alt="">' : '') + '<div><div><b>' + esc(t.title) + '</b></div><div class="msg" style="margin:2px 0 8px">' + esc(t.artist) + '</div>' + clip + lyTag +
        (ly && ly.preview.length ? '<ul>' + ly.preview.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>';
    }).catch(function () { $('out').innerHTML = '<p class="msg err">Erreur r\u00e9seau.</p>'; }).then(function () { $('go').disabled = false; });
  }
  $('go').addEventListener('click', runTest);
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') runTest(); });

  function status() {
    $('pill').className = 'pill'; $('pill').textContent = 'v\u00e9rification\u2026';
    fetch('/api/status').then(function (r) { return r.json(); }).then(function (d) {
      $('pill').className = 'pill ' + (d.ok ? 'ok' : 'bad');
      $('pill').textContent = d.ok ? 'Tout fonctionne' : 'Probl\u00e8me d\u00e9tect\u00e9';
      $('checks').innerHTML = d.checks.map(function (c) {
        var k = c.ok ? (c.warn ? 'warn' : 'ok') : 'bad';
        return '<div class="chk"><span class="dot ' + k + '"></span><span>' + esc(c.label) + '</span><span class="d">' + esc(c.detail) + (c.ms ? ' \u00b7 ' + c.ms + ' ms' : '') + '</span></div>';
      }).join('');
    }).catch(function () { $('pill').className = 'pill bad'; $('pill').textContent = 'Injoignable'; });
  }
  $('recheck').addEventListener('click', status);

  refresh(); loadInfo(); status();
})();
</script>
</body>
</html>`;
