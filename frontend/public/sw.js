/*
 * Service worker Panel Absensi PKL.
 * - Precache kerangka aplikasi (app shell) agar bisa dibuka saat luring.
 * - Aset statis sama origin: cache-first (bernama hash, aman untuk versi baru).
 * - /api dan /uploads: SELALU jaringan, tidak pernah disinggahi (data harus segar).
 */
const CACHE = 'astakira-absensi-v1';
const SHELL = ['/', '/manifest.webmanifest', '/ikon/ikon-192.png', '/ikon/ikon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((daftar) => Promise.all(daftar.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API & berkas unggahan (foto profil): selalu jaringan, tanpa cache, tanpa penangguhan
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads'))) {
    return;
  }

  // Navigasi halaman: jaringan dulu, jatuh ke shell cache saat luring
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          void caches.open(CACHE).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Aset statis sama origin: cache-first, lalu isi cache bila baru
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(
        (tadi) =>
          tadi ||
          fetch(req).then((res) => {
            if (res.ok) void caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
  }
});
