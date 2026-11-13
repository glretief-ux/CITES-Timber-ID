/* Offline support. Pages and data: network first, cache as fallback. Photos, drawings, fonts: cache first. */
const V = "timberid-v3";
const CORE = ["index.html", "key.html", "check.html", "field.html", "about.html", "map.html", "assets/map.js", "assets/world.json", "assets/app.css", "assets/common.js", "assets/lookup.js", "assets/key.js", "assets/check.js", "assets/icon.svg", "data/timber.json", "byte.js", "byte-config.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const stat = /\/(photos|schematics|assets\/fonts)\//.test(u.pathname) || /\.onnx$/.test(u.pathname);
  const put = r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; };
  e.respondWith(stat ? caches.match(e.request).then(r => r || fetch(e.request).then(put))
    : fetch(e.request).then(put).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
