require('dotenv').config();

const wajib = ['JWT_SECRET', 'FACE_KEY', 'DB_NAME', 'DB_USER'];
const kosong = wajib.filter((k) => !process.env[k]);
if (kosong.length) {
  console.error('Variabel .env belum diisi: ' + kosong.join(', '));
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET minimal 32 karakter.');
  process.exit(1);
}
if (!/^[0-9a-fA-F]{64}$/.test(process.env.FACE_KEY)) {
  console.error('FACE_KEY harus 64 karakter hex (32 byte).');
  process.exit(1);
}

const prod = process.env.NODE_ENV === 'production';

const n = (k, d) => Number(process.env[k] ?? d);

module.exports = {
  prod,
  port: n('PORT', 4000),
  tz: process.env.TZ_APLIKASI || 'Asia/Jakarta',
  trustProxy: process.env.TRUST_PROXY === 'true',
  dbSync: process.env.DB_SYNC === 'true',
  // Produksi: backend menyajikan build frontend/dist (CSP berlaku penuh di origin yang sama)
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: n('DB_PORT', 3306),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS || '',
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim()),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  qrTtl: n('QR_TTL_DETIK', 30),
  face: {
    key: Buffer.from(process.env.FACE_KEY, 'hex'),
    threshold: n('FACE_THRESHOLD', 0.5),
    dim: n('FACE_DIM', 128),
    ttl: n('FACE_VERIFY_TTL_DETIK', 180),
    // Tantangan liveness (mode A): nonce sekali pakai + instruksi gerakan acak dari server
    tantanganTtl: n('LIVENESS_TTL_DETIK', 60),
    // Foto wajah peserta (dibuat oleh siswa saat verifikasi, terenkripsi, terikat absensi)
    foto: {
      maksBait: n('FACE_FOTO_MAKS_BAIT', 300_000),
      retensiHari: n('FACE_FOTO_RETENSI_HARI', 30),
    },
  },
  jurnal: {
    // Peserta maksimal menulis jurnal sampai N hari ke belakang (0 = hanya hari ini)
    maksBuka: n('JURNAL_MAKS_HARI_BELAKANG', 7),
  },
  pengajuan: {
    // Pengajuan izin/sakit boleh mengajukan sampai N hari ke depan (default: besok)
    maksMaju: n('PENGAJUAN_MAKS_HARI_MAJU', 1),
  },
  tutupHari: {
    // Job penutup hari menandai Tidak hadir dari jam_pulang + selisih menit ini
    menit: n('TUTUP_HARI_MENIT', 60),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: n('SMTP_PORT', 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Astakira Media <no-reply@astakira.id>',
  },
};
