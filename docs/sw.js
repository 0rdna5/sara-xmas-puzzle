
const CACHE = "spq-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./levels.json",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/img/level_001.jpg",
  "./assets/img/level_002.jpg",
  "./assets/img/level_003.jpg",
  "./assets/img/level_004.jpg",
  "./assets/img/level_005.jpg",
  "./assets/img/level_006.jpg",
  "./assets/img/level_007.jpg",
  "./assets/img/level_008.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchAndCache = fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => {
          if (cached) return cached;
          if (e.request.mode === "navigate") return caches.match("./index.html");
          return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        });

      return cached || fetchAndCache;
    })
  );
});
