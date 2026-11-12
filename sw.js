/* BCHC Teacher Connect service worker (v9).
   - The app opens even without internet: the last downloaded version is kept on the phone.
   - With internet it always loads the newest version first.
   - Attendance data is never cached here; the app saves offline check-ins itself and uploads them later. */
var CACHE = 'bchc-v9-1';
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

/* ---- background upload of offline check-ins (v9.1) ----
   The app keeps a copy of each offline entry in IndexedDB "bchc-bg". When the phone gets internet again,
   Android Chrome wakes this worker (Background Sync) and it uploads the entries, even if the app is closed. */
function bgDb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('bchc-bg', 1);
    r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('q')) d.createObjectStore('q', { keyPath: 'id' }); if (!d.objectStoreNames.contains('done')) d.createObjectStore('done', { keyPath: 'id' }); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  });
}
function bgAll(d) { return new Promise(function (res, rej) { var r = d.transaction('q').objectStore('q').getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { rej(r.error); }; }); }
function bgFinish(d, id, done) {
  return new Promise(function (res, rej) {
    var t = d.transaction(['q', 'done'], 'readwrite'); t.objectStore('q').delete(id); t.objectStore('done').put(done);
    t.oncomplete = res; t.onerror = function () { rej(t.error); };
  });
}
function bgUpload() {
  return bgDb().then(function (d) {
    return bgAll(d).then(function (items) {
      items.sort(function (a, b) { return a.id < b.id ? -1 : 1; });   // check-in before check-out
      var sent = 0;
      function next(i) {
        if (i >= items.length) return sent;
        var it = items[i];
        return fetch(it.url, { method: 'POST', body: JSON.stringify(it.body) })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            sent++;
            return bgFinish(d, it.id, { id: it.id, ok: !!(res && res.ok), error: res && !res.ok ? (res.error || 'Not accepted') : '' });
          }, function (err) { throw new Error('offline'); })   // no internet yet: the browser tries again later
          .then(function () { return next(i + 1); });
      }
      return next(0);
    });
  }).then(function (sent) {
    if (sent) return self.clients.matchAll({ includeUncontrolled: true }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ type: 'bchc-uploaded', count: sent }); }); });
  });
}
self.addEventListener('sync', function (e) { if (e.tag === 'bchc-upload') e.waitUntil(bgUpload()); });
self.addEventListener('message', function (e) { if (e.data && e.data.type === 'bchc-upload-now') e.waitUntil(bgUpload().catch(function () {})); });
