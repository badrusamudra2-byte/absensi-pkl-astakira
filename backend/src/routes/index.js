const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { auth, role } = require('../middleware/auth');
const upload = require('../middleware/upload');

const C = {
  auth: require('../controllers/auth'),
  profil: require('../controllers/profil'),
  face: require('../controllers/face'),
  absensi: require('../controllers/absensi'),
  jurnal: require('../controllers/jurnal'),
  pembimbing: require('../controllers/pembimbing'),
  admin: require('../controllers/admin'),
  pengaturan: require('../controllers/pengaturan'),
};

// Rate limit berlaku untuk semua lingkungan imbang NODE_ENV=test — agar pengujian supertest
// yang memanggil ulang rute yang sama tidak terkena 429. Rute produksi tetap dibatasi.
const lewatTes = process.env.NODE_ENV === 'test';
const batas = (menit, maks) => lewatTes ? (rq, os, next) => next() : rateLimit({
  windowMs: menit * 60 * 1000, limit: maks, standardHeaders: true, legacyHeaders: false,
  message: { pesan: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.', kode: 'RATE_LIMIT' },
});

const PESERTA = [auth, role('peserta')];
const PEMBIMBING = [auth, role('pembimbing')];
const ADMIN = [auth, role('admin')];

router.get('/health', (req, res) => res.json({ ok: true }));

// Autentikasi dan profil (semua peran)
router.post('/auth/login', batas(15, 10), C.auth.login);
router.post('/auth/lupa-password', batas(15, 5), C.auth.lupa);
router.post('/auth/reset-password', batas(15, 10), C.auth.reset);
router.get('/auth/me', auth, C.auth.me);
router.put('/profil/password', auth, batas(15, 10), C.profil.password);
router.post('/profil/foto', auth, upload, C.profil.foto);
router.get('/workshift', auth, C.admin.wsList);
router.get('/pengaturan/absensi', auth, C.pengaturan.lihat);
router.put('/pengaturan/absensi', ...ADMIN, C.pengaturan.ubah);

// Peserta: scan QR pembimbing, wajah, absensi wajah, riwayat, jurnal
router.get('/face/template', ...PESERTA, C.face.cekTemplate);
router.post('/face/enroll', ...PESERTA, batas(15, 5), C.face.enroll);
router.post('/face/tantangan', ...PESERTA, batas(1, 30), C.face.tantangan);
router.post('/face/verify', ...PESERTA, batas(1, 10), C.face.verify);
router.post('/absensi/konfirmasi-scan', ...PESERTA, batas(1, 30), C.absensi.konfirmasiScan);
router.post('/absensi/wajah', ...PESERTA, batas(1, 10), C.absensi.wajah);
router.get('/absensi/riwayat', ...PESERTA, C.absensi.riwayat);
router.get('/jurnal', ...PESERTA, C.jurnal.list);
router.post('/jurnal', ...PESERTA, C.jurnal.create);
router.get('/jurnal/:id', ...PESERTA, C.jurnal.detail);
router.put('/jurnal/:id', ...PESERTA, C.jurnal.update);

// Pembimbing: tampilkan QR yang dipindai peserta, review, rekap
router.post('/absensi/qr-tayang', ...PEMBIMBING, batas(1, 60), C.absensi.tayangkanQr);
router.get('/pembimbing/ringkasan', ...PEMBIMBING, C.pembimbing.ringkasan);
router.get('/pembimbing/peserta', ...PEMBIMBING, C.pembimbing.peserta);
router.get('/pembimbing/jurnal', ...PEMBIMBING, C.pembimbing.jurnal);
router.get('/pembimbing/jurnal/:id', ...PEMBIMBING, C.pembimbing.detailJurnal);
router.post('/pembimbing/jurnal/:id/review', ...PEMBIMBING, C.pembimbing.review);
router.post('/pembimbing/keterangan', ...PEMBIMBING, batas(1, 30), C.pembimbing.catatKet);
router.get('/pembimbing/rekap', ...PEMBIMBING, C.pembimbing.rekap);

// Admin
router.get('/admin/ringkasan', ...ADMIN, C.admin.ringkasan);
for (const [path, h] of [['peserta', C.admin.peserta], ['pembimbing', C.admin.pembimbing]]) {
  router.get(`/admin/${path}`, ...ADMIN, h.list);
  router.post(`/admin/${path}`, ...ADMIN, h.create);
  router.get(`/admin/${path}/:id`, ...ADMIN, h.detail);
  router.put(`/admin/${path}/:id`, ...ADMIN, h.update);
  router.delete(`/admin/${path}/:id`, ...ADMIN, h.remove);
}
router.put('/admin/workshift', ...ADMIN, C.admin.wsSimpan);
router.get('/admin/laporan', ...ADMIN, C.admin.laporan);
router.get('/admin/audit', ...ADMIN, C.admin.audit);
router.get('/admin/absensi', ...ADMIN, C.admin.absensiPerTanggal);
router.post('/admin/absensi/keterangan', ...ADMIN, C.admin.catatKet);
router.put('/admin/absensi/:id', ...ADMIN, C.admin.koreksi);
router.delete('/admin/face/:id', ...ADMIN, C.admin.resetWajah);

module.exports = router;
