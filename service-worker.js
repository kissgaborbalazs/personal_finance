const CACHE = 'hazipenz-v1';
const ASSETS = ['/', '/index.html', '/css/style.css', '/js/app.js', '/js/db.js', '/manifest.json'];

self.addEventListener('install', e =>
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);

self.addEventListener('activate', e =>
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ))
);

self.addEventListener('fetch', e => {
    if (e.request.url.includes('supabase') || e.request.url.includes('frankfurter')) return;
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
