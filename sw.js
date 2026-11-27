// network-first cache so the game works offline after one visit
const CACHE = 'ap2-v8';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // revalidate with the server (ETag) instead of trusting the HTTP cache, so a new build is picked up on the next load
  const same = new URL(e.request.url).origin === location.origin;
  e.respondWith(fetch(e.request, same ? { cache: 'no-cache' } : undefined).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
