/* BCHC Teacher Connect service worker: always loads the latest version from the internet.
   It only shows a friendly message when the phone is offline. Attendance always needs internet. */
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;background:#121212;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><h2 style="color:#ffd200">No internet</h2><p>BCHC Teacher Connect needs internet to mark attendance. Turn on mobile data or Wi-Fi and try again.</p><button onclick="location.reload()" style="padding:12px 20px;border:0;border-radius:12px;background:#ffd200;font-weight:700">Try again</button></div></body>', { headers: { 'Content-Type': 'text/html' } });
  }));
});
