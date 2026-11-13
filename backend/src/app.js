const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, onError } = require('./middleware/error');

const app = express();
if (env.trustProxy) app.set('trust proxy', 1); // wajib bila di belakang Nginx agar IP asli terbaca

// CSP aktif hanya bila frontend dilayani dari origin ini (SERVE_FRONTEND=true).
// Mesin pembanding wajah (MediaPipe) membutuhkan wasm-unsafe-eval; pustaka QR
// kini dibundel lokal (public/vendor) sehingga skrip tidak ada pihak ketiganya.
const CSP = env.serveFrontend && {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    connectSrc: ["'self'"],
    workerSrc: ["'self'", 'blob:'],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    ...(env.prod ? { upgradeInsecureRequests: [] } : {}),
  },
};

app.use(
  helmet({
    // Foto profil diambil frontend origin lain saat pengembangan; bila sama origin, ketat
    crossOriginResourcePolicy: { policy: env.serveFrontend ? 'same-origin' : 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    contentSecurityPolicy: CSP,
    strictTransportSecurity: env.prod ? { maxAge: 15552000, includeSubDomains: true } : false,
  }),
);
app.use(cors({ origin: env.corsOrigin }));
// Morgan hanya mencatat baris permintaan (method, URL, status, durasi) — bukan header/token isi
const fs = require('fs');
const folderLog = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(folderLog)) fs.mkdirSync(folderLog, { recursive: true });
const arusLog = fs.createWriteStream(path.join(folderLog, 'akses.log'), { flags: 'a' });
app.use(morgan((tokens, req, res) => {
  const baris = [
    new Date().toISOString(), req.method, req.originalUrl,
    tokens.status(req, res), tokens['response-time'](req, res) + 'ms',
    req.get('origin') || '-', req.ip || '-',
  ].join(' | ');
  arusLog.write(baris + '\n');
  return baris;
}));
// SEMENTARA (diagnostik): catat isi respons scan QR agar alasan penolakan 409 terbaca.
app.use((req, res, next) => {
  if (req.method === 'POST' && req.originalUrl === '/api/absensi/scan') {
    const j = res.json.bind(res);
    res.json = (b) => {
      arusLog.write('BODY-SCAN ' + JSON.stringify(b).slice(0, 300) + '\n');
      return j(b);
    };
  }
  next();
});
// 1mb: menampung foto wajah JPEG (maks FACE_FOTO_MAKS_BAIT, diperluas base64) pada /face/verify
app.use(express.json({ limit: '1mb' }));

// Bukti pengajuan dan lampiran jurnal tidak dibentangkan statis: bisa berisi
// data pribadi. Akses hanya lewat API (GET /api/pengajuan/bukti/:berkas dan
// GET /api/jurnal/:id/lampiran) yang memeriksa login dan kepemilikan.
// Foto profil memang disengaja publik (dipakai lintas origin saat pengembangan).
app.use('/uploads', (req, res, next) => {
  const p = req.path.toLowerCase();
  if (p.startsWith('/pengajuan') || p.startsWith('/lampiran')) {
    return res.status(404).json({
      pesan: 'Berkas ini hanya bisa dibuka lewat API yang memeriksa izin akses.',
      kode: 'TIDAK_ADA',
    });
  }
  next();
}, express.static(path.join(__dirname, '../uploads'), { index: false, dotfiles: 'deny' }));
app.use('/api', routes);

// Produksi: sajikan build frontend (CSP pasangan dengan index.html) + SPA fallback
if (env.serveFrontend) {
  const dist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/(?:api|uploads)(?:\/|$)).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(onError);

module.exports = app;
