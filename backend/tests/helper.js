const bcrypt = require('bcryptjs');
const M = require('../src/models');

/** Urutan tabel menurun supaya truncate aman (tidak ada FK eksplisit, tapi hati-hati). */
const TABEL = [
  'audit_log',
  'jurnal_review',
  'jurnal',
  'absensi_penolakan',
  'wajah_foto',
  'pengajuan_izin',
  'absensi',
  'qr_tokens',
  'tantangan_wajah',
  'face_verifications',
  'face_templates',
  'workshift',
  'pengaturan_absensi',
  'peserta',
  'pembimbing',
  'users',
];

/** Buang semua data tabel tes; dipanggil tiap beforeAll/beforeEach sesuai kebutuhan file tes. */
async function kosongkanDb() {
  await M.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of TABEL) await M.sequelize.query(`TRUNCATE TABLE \`${t}\``);
  await M.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  // Singgahan pengaturan dibuang agar mode yang diubah kasus sebelumnya tidak bocor ke kasus berikutnya
  require('../src/services/pengaturan').segarkan();
}

/** Sandi sama dengan SEED_PASSWORD (lihat scripts/seed.js). */
const SANDI_SEED = process.env.SEED_PASSWORD || 'password';

/** Membuat user siap pakai; opsi { nama, username, email, role, aktif, password }. */
async function buatUser({ nama, username, email, role, aktif = true, password = SANDI_SEED }) {
  return M.User.create({
    nama,
    username,
    email,
    role,
    aktif,
    password_hash: await bcrypt.hash(password, 10),
  });
}

/** Isi data dasar: admin, pembimbing (+profil), peserta aktif/nonaktif (+profil). */
async function isiDasar() {
  const admin = await buatUser({ nama: 'Admin Astakira', username: 'admin', email: 'admin@astakira.id', role: 'admin' });
  const pmb = await buatUser({ nama: 'Rizal Hakim', username: 'rizal', email: 'rizal@astakira.id', role: 'pembimbing' });
  const psr = await buatUser({ nama: 'Alya Rahma', username: 'alya', email: 'alya@astakira.id', role: 'peserta' });
  const pnr = await buatUser({ nama: 'Dimas', username: 'dimas', email: 'dimas@astakira.id', role: 'peserta', aktif: false });

  await M.Pembimbing.create({ user_id: pmb.id, divisi: 'Desain Grafis' });
  await M.Peserta.create({ user_id: psr.id, divisi: 'Desain Grafis', pembimbing_id: pmb.id });
  await M.Peserta.create({ user_id: pnr.id, divisi: 'Sosial Media', pembimbing_id: pmb.id });

  // Jadwal kerja standar: Senin-Jumat, masuk 08:00
  const kerja = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  for (const hari of ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']) {
    await M.Workshift.findOrCreate({
      where: { hari },
      defaults: {
        hari_kerja: kerja.includes(hari),
        jam_masuk: '08:00:00',
        jam_pulang: hari === 'Jumat' ? '15:30:00' : '16:00:00',
        toleransi_menit: 15,
      },
    });
  }

  return { admin, pembimbing: pmb, peserta: psr, nonaktif: pnr };
}

/** Login lewat API sungguhan dan kembalikan bentuk Authorization siap header. */
function tokenUntuk(identifier, password = SANDI_SEED) {
  const request = require('supertest');
  const app = require('../src/app');
  return request(app)
    .post('/api/auth/login')
    .send({ identifier, password })
    .then(async (r) => {
      if (r.status !== 200) {
        // Diagnostik kegagalan login persiapan tes (kadang terjadi tanpa sebab jelas):
        // cetak isi tabel users agar penyebabnya terlihat saat berulang.
        const M = require('../src/models');
        const [rows] = await M.sequelize.query('SELECT id, username, email, role FROM users');
        console.error('Diagnostik: isi tabel users saat login gagal (' + identifier + '):', JSON.stringify(rows));
        throw new Error('Login gagal saat menyiapkan tes: ' + JSON.stringify(r.body));
      }
      return 'Bearer ' + r.body.token;
    });
}

module.exports = { kosongkanDb, buatUser, isiDasar, tokenUntuk, SANDI_SEED, TABEL };

// Tutup pool DB agar jest berhenti bersih setelah semua tes dalam berkas ini selesai
afterAll(async () => {
  await require('../src/models').sequelize.close();
});

