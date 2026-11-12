/* BCHC Teacher Connect service worker (v9).
   - The app opens even without internet: the last downloaded version is kept on the phone.
   - With internet it always loads the newest version first.
   - Attendance data is never cached here; the app saves offline check-ins itself and uploads them later. */
var CACHE = 'bchc-v9';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './logo.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function offlinePage() {
  return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;background:#121212;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><h2 style="color:#ffd200">No internet</h2><p>Open BCHC Teacher Connect once with internet so it can work offline next time.</p><button onclick="location.reload()" style="padding:12px 20px;border:0;border-radius:12px;background:#ffd200;font-weight:700">Try again</button></div></body>', { headers: { 'Content-Type': 'text/html' } });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // attendance uploads go straight to the server
  var url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && /\/(index\.html)?$/.test(url.pathname)) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); }
      return res;
    }).catch(function () {
      return caches.match('./index.html').then(function (r) { return r || caches.match('./').then(function (r2) { return r2 || offlinePage(); }); });
    }));
    return;
  }
  // icons, fonts, Excel tool: use the saved copy, refresh it in the background
  e.respondWith(caches.match(req, { ignoreSearch: url.origin === location.origin }).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
