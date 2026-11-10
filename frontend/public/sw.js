/*
 * Service worker Panel Absensi PKL.
 * - Precache kerangka aplikasi (app shell) agar bisa dibuka saat luring.
 * - Aset statis sama origin: cache-first (bernama hash, aman untuk versi baru).
 * - /api dan /uploads: SELALU jaringan, tidak pernah disinggahi (data harus segar).
 */
const CACHE = 'astakira-absensi-v2';
// Pustaka QR disertakan precache: fitur absensi luring (tayang + pemindai) wajib tetap jalan.
const SHELL = [
  '/', '/manifest.webmanifest', '/ikon/ikon-192.png', '/ikon/ikon-512.png',
  '/vendor/qrcode.min.js', '/vendor/jsQR.min.js',
];

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

  // Navigasi halaman: jaringan dulu, jatuh ke shell cache saat luring.
  // Hanya respons OK yang boleh menimpa cache shell — halaman galat (500 dst) tidak
  // boleh menjadi shell luring berikutnya.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok) return res;
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
