const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const env = require('../src/config/env');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk } = require('./helper');
const waktu = require('../src/utils/waktu'); // mock untuk pembekuan jam uji
const { bagian } = require('../src/utils/waktu');
const tutupLive = require('../src/services/live-tutup');

// Waktu "sekarang" dibekukan lewat bagian() (pola sama dengan lokasi.test.js)
jest.mock('../src/utils/waktu', () => {
  const asli = jest.requireActual('../src/utils/waktu');
  let tetap = null;
  return {
    ...asli,
    bagian: (date = tetap !== null ? new Date(tetap) : undefined) => asli.bagian(date),
    __jam: (teks) => {
      const [j, m] = teks.split(':');
      tetap = Date.UTC(2026, 5, 15, Number(j) - 7, Number(m), 0);
    },
    __jamLepas: () => { tetap = null; },
  };
});

beforeEach(async () => {
  await kosongkanDb();
  // Hapus tabel sesi_tracking lalu biarkan model membuat ulang (timestamps: false)
  await M.sequelize.query('DROP TABLE IF EXISTS sesi_tracking');
  await M.sequelize.sync({ force: false }); // pastikan model dikenali
});

const hariKerja = async () => {
  const ws = await M.Workshift.findOne({ where: { hari: bagian().hari } });
  await ws.update({ hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00', toleransi_menit: 15 });
};

const POSISI = { lat: -6.2, lng: 106.816, akurasi_m: 12 };
const VEK = () => Array.from({ length: env.face.dim }, (_, i) => (i % 2 ? -0.1 : 0.1));

// Mode wajah: absen masuk/pulang langsung lewat /absensi/wajah (paling ringkas untuk uji)
const siapWajah = async (peserta) => {
  const authz = await tokenUntuk(peserta.email);
  await request(app).post('/api/face/enroll').set('Authorization', authz).send({ embedding: VEK(), persetujuan: true });
  const tan = await request(app).post('/api/face/tantangan').set('Authorization', authz);
  return { authz, nonce: tan.body.nonce };
};

// Tantangan baru (template sudah terdaftar; enroll ulang akan ditolak TEMPLATE_ADA)
const tanBaru = async (peserta) => {
  const authz = await tokenUntuk(peserta.email);
  const tan = await request(app).post('/api/face/tantangan').set('Authorization', authz);
  return { authz, nonce: tan.body.nonce };
};

const absen = (authz, jenis, nonce) =>
  request(app).post('/api/absensi/wajah').set('Authorization', authz).send({ jenis, embedding: VEK(), nonce });

const sesi = (uid, tanggal) => M.SesiTracking.findOne({ where: { user_id: uid, ...(tanggal ? { tanggal } : {} ) } });

/* ---------- Peserta: persetujuan, status, dan kiriman posisi ---------- */
describe('/live: izin, status, posisi (peserta)', () => {
  afterEach(() => waktu.__jamLepas());

  test('posisi tanpa persetujuan -> 403 LIVE_BELUM_SETUJU; setuju lalu tanpa sesi -> 409 LIVE_TIDAK_AKTIF', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const tolak = await request(app).post('/api/live/posisi').set('Authorization', authz).send(POSISI);
    expect(tolak.status).toBe(403);
    expect(tolak.body).toMatchObject({ kode: 'LIVE_BELUM_SETUJU' });

    const izin = await request(app).put('/api/live/izin').set('Authorization', authz);
    expect(izin.status).toBe(200);
    expect(izin.body.setuju).toBe(true);
    expect(await M.User.findByPk(peserta.id)).toMatchObject({ setuju_live_tracking: true });
    // Belum absen masuk -> belum ada sesi
    expect(izin.body.sesi).toBeNull();

    const posisi = await request(app).post('/api/live/posisi').set('Authorization', authz).send(POSISI);
    expect(posisi.status).toBe(409);
    expect(posisi.body).toMatchObject({ kode: 'LIVE_TIDAK_AKTIF' });

    // Audit persetujuan tercatat
    const admin = await tokenUntuk('admin@astakira.id');
    const au = await request(app).get('/api/admin/audit').set('Authorization', admin);
    expect(au.body.data.some((x) => x.aksi === 'Setuju live tracking')).toBe(true);
  });

  test('izin di tengah hari: sesi dibuka bila sudah absen masuk dan belum lewat jam pulang', async () => {
    const { admin, peserta } = await isiDasar();
    await hariKerja();
    await request(app).put('/api/pengaturan/absensi').set('Authorization', await tokenUntuk(admin.email)).send({ metode: 'wajah' });
    waktu.__jam('09:00');
    const { authz, nonce } = await siapWajah(peserta);
    expect((await absen(authz, 'masuk', nonce)).status).toBe(200);

    const izin = await request(app).put('/api/live/izin').set('Authorization', authz);
    expect(izin.body.sesi).not.toBeNull();
    expect(await sesi(peserta.id)).toMatchObject({ status: 'aktif', tanggal: bagian().tanggal });
  });

  test('siklus lengkap: masuk buka sesi, posisi di-upsert (tanpa jejak), pulang menutup + mengosongkan, kiriman sesudahnya ditolak', async () => {
    const { admin, peserta } = await isiDasar();
    await hariKerja();
    await request(app).put('/api/pengaturan/absensi').set('Authorization', await tokenUntuk(admin.email)).send({ metode: 'wajah' });
    const authz = await tokenUntuk(peserta.email);
    await request(app).put('/api/live/izin').set('Authorization', authz);

    waktu.__jam('08:00');
    let { nonce } = await siapWajah(peserta);
    expect((await absen(authz, 'masuk', nonce)).status).toBe(200);
    expect(await sesi(peserta.id)).toMatchObject({ status: 'aktif' });

    // Kirim posisi berulang: hanya baris sesi yang berubah (satu baris, tanpa riwayat)
    const p1 = await request(app).post('/api/live/posisi').set('Authorization', authz).send(POSISI);
    expect(p1.status).toBe(200);
    const p2 = await request(app).post('/api/live/posisi').set('Authorization', authz)
      .send({ lat: -6.199, lng: 106.816, akurasi_m: 15 });
    expect(p2.status).toBe(200);
    expect(await M.SesiTracking.count({ where: { user_id: peserta.id } })).toBe(1);
    const berjalan = await sesi(peserta.id);
    expect(berjalan).toMatchObject({ lat: -6.199, akurasi_m: 15 });
    expect(berjalan.diperbarui_pada).not.toBeNull();

    // Status peserta menampilkan sesi aktif
    const st = await request(app).get('/api/live/status').set('Authorization', authz);
    expect(st.body).toMatchObject({ setuju: true });
    expect(st.body.sesi).not.toBeNull();

    waktu.__jam('16:00');
    ({ nonce } = await tanBaru(peserta));
    expect((await absen(authz, 'pulang', nonce)).status).toBe(200);
    const selesai = await sesi(peserta.id);
    expect(selesai).toMatchObject({ status: 'selesai', sebab: 'pulang' });
    // Posisi terakhir dihapus saat sesi ditutup
    expect(selesai.lat).toBeNull();
    expect(selesai.diperbarui_pada).toBeNull();

    // Server menolak kiriman posisi sesudah pulang (cek di server, bukan frontend)
    const tolak = await request(app).post('/api/live/posisi').set('Authorization', authz).send(POSISI);
    expect(tolak.status).toBe(409);
    expect(tolak.body).toMatchObject({ kode: 'LIVE_TIDAK_AKTIF' });
  });
});

/* ---------- Peta live: pembimbing & admin ---------- */
describe('/live/peta (pembimbing & admin)', () => {
  afterEach(() => waktu.__jamLepas());

  test('pembimbing hanya bimbingannya; admin semua; akses masuk audit log', async () => {
    const { admin, pembimbing, peserta } = await isiDasar();
    await hariKerja();
    // Peserta kedua di bawah pembimbing lain (tidak terlihat oleh pembimbing pertama)
    const pmb2 = await buatUser({ nama: 'Bim Kedua', username: 'bim2', email: 'bim2@astakira.id', role: 'pembimbing' });
    const psr2 = await buatUser({ nama: 'Bimo', username: 'bimo', email: 'bimo@astakira.id', role: 'peserta' });
    await M.Peserta.create({ user_id: pmb2.id, divisi: 'x' }); // profil pembimbing kedua
    await M.Peserta.create({ user_id: psr2.id, divisi: 'x', pembimbing_id: pmb2.id });

    await request(app).put('/api/pengaturan/absensi').set('Authorization', await tokenUntuk(admin.email)).send({ metode: 'wajah' });
    waktu.__jam('08:00');
    const { authz, nonce } = await siapWajah(peserta);
    await request(app).put('/api/live/izin').set('Authorization', authz);
    await absen(authz, 'masuk', nonce);
    await request(app).post('/api/live/posisi').set('Authorization', authz).send(POSISI);

    const pmb = await request(app).get('/api/live/peta').set('Authorization', await tokenUntuk(pembimbing.email));
    expect(pmb.status).toBe(200);
    const nama = pmb.body.data.map((d) => d.nama);
    expect(nama).toContain(peserta.nama);
    expect(nama).not.toContain(psr2.nama);
    const baris = pmb.body.data.find((d) => d.nama === peserta.nama);
    expect(baris).toMatchObject({ status: 'Aktif', lat: POSISI.lat, menit_lalu: 0 });

    const adm = await request(app).get('/api/live/peta').set('Authorization', await tokenUntuk(admin.email));
    const namaAdm = adm.body.data.map((d) => d.nama);
    expect(namaAdm).toContain(psr2.nama); // nonaktif tidak ikut (isiDasar punya peserta nonaktif)
    expect(namaAdm).not.toContain('Dimas');

    // Peserta tanpa sesi (belum absen masuk) -> Selesai
    const bimo = adm.body.data.find((d) => d.nama === psr2.nama);
    expect(bimo.status).toBe('Selesai');

    // Audit akses peta
    const au = await request(app).get('/api/admin/audit').set('Authorization', await tokenUntuk(admin.email));
    const lihat = au.body.data.filter((x) => x.aksi === 'Lihat peta live');
    expect(lihat.length).toBe(2); // pembimbing + admin

    // Peserta tidak boleh membuka peta
    expect((await request(app).get('/api/live/peta').set('Authorization', authz)).status).toBe(403);
  });

  test('status Terputus (posisi lama) dan Selesai (sesi ditutup, tanpa titik)', async () => {
    const { admin, pembimbing, peserta } = await isiDasar();
    await hariKerja();
    await request(app).put('/api/pengaturan/absensi').set('Authorization', await tokenUntuk(admin.email)).send({ metode: 'wajah' });
    waktu.__jam('08:00');
    const { authz, nonce } = await siapWajah(peserta);
    await request(app).put('/api/live/izin').set('Authorization', authz);
    await absen(authz, 'masuk', nonce);
    await request(app).post('/api/live/posisi').set('Authorization', authz).send(POSISI);
    // Posisi terakhir dibuat tampak 10 menit lalu
    await M.SesiTracking.update(
      { diperbarui_pada: new Date(Date.now() - 10 * 60 * 1000) },
      { where: { user_id: peserta.id } },
    );

    let r = await request(app).get('/api/live/peta').set('Authorization', await tokenUntuk(pembimbing.email));
    let baris = r.body.data.find((d) => d.nama === peserta.nama);
    expect(baris.status).toBe('Terputus');
    expect(baris.menit_lalu).toBeGreaterThanOrEqual(10);

    waktu.__jam('16:00');
    const { nonce: n2 } = await tanBaru(peserta);
    await absen(authz, 'pulang', n2);
    r = await request(app).get('/api/live/peta').set('Authorization', await tokenUntuk(pembimbing.email));
    baris = r.body.data.find((d) => d.nama === peserta.nama);
    expect(baris).toMatchObject({ status: 'Selesai', lat: null, sebab: 'pulang' });
  });
});

/* ---------- Penutup otomatis ---------- */
describe('tutupLive (job otomatis)', () => {
  afterEach(() => waktu.__jamLepas());

  test('sesi ditutup dan posisi dihapus pada jam pulang + toleransi; sisa kemarian ikut ditutup', async () => {
    const { peserta } = await isiDasar();
    await hariKerja();
    const kemarin = new Date(Date.now() - 26 * 3600 * 1000);
    const tglKemarin = bagian(kemarin).tanggal;
    // Sesi hari ini (dengan posisi) + sisa sesi dari kemarin
    await M.SesiTracking.create({ user_id: peserta.id, tanggal: bagian().tanggal, status: 'aktif', mulai_pada: new Date(), lat: POSISI.lat, lng: POSISI.lng, diperbarui_pada: new Date() });
    const sisa = await M.SesiTracking.create({ user_id: peserta.id, tanggal: tglKemarin, status: 'aktif', mulai_pada: kemarin, lat: 1, lng: 1 });

    // Sebelum jam pulang + toleransi (16:15): hari ini belum ditutup
    let r = await tutupLive({ sekarang: new Date(Date.UTC(2026, 5, 15, 9, 30)) });
    expect(r.ditutupHariIni).toBe(0);
    expect(await sesi(peserta.id)).toMatchObject({ status: 'aktif' });

    // Lewat 16:15: keduanya ditutup, posisi dikosongkan
    r = await tutupLive({ sekarang: new Date(Date.UTC(2026, 5, 15, 9, 30 + 7 * 60)) }); // 16:30 WIB
    expect(r.ditutupHariIni).toBe(1);
    const h = await sesi(peserta.id);
    expect(h).toMatchObject({ status: 'selesai', sebab: 'otomatis', lat: null });
    expect(h.id).not.toBe(sisa.id); // sisa kemarin baris terpisah juga selesai
    expect(await M.SesiTracking.count({ where: { status: 'aktif' } })).toBe(0);
  });
});
