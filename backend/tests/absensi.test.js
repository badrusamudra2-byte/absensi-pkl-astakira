const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const env = require('../src/config/env');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk } = require('./helper');
const waktu = require('../src/utils/waktu'); // mock di bawah untuk pembekuan jam uji
const { bagian, hitungStatus, menitDariJam } = require('../src/utils/waktu');

// Waktu "sekarang" server hanya melewati bagian() — jadi jam server uji cukup
// dibekukan di lapisan ini tanpa mengubah kode produksi. Secara bawaan lewat.
jest.mock('../src/utils/waktu', () => {
  const asli = jest.requireActual('../src/utils/waktu');
  let tetap = null;
  return {
    ...asli,
    bagian: (date = tetap !== null ? new Date(tetap) : undefined) => asli.bagian(date),
    __jam: (teks) => { // 'HH:MM' WIB pada Senin tetap 2026-06-15 agar tanggal-konsisten
      const [j, m] = teks.split(':');
      tetap = Date.UTC(2026, 5, 15, Number(j) - 7, Number(m), 0);
    },
    __jamLepas: () => { tetap = null; },
  };
});

beforeEach(kosongkanDb);

/** Hari-jam menurut zona aplikasi (harus sama dengan src/utils/waktu.js) */
const hariIni = () => bagian();

// Embedding dik = dimensi dari env; vektor tetap agar deterministik.
const VEK = (geser = 0) => Array.from({ length: env.face.dim }, (_, i) => ((i % 2 ? -0.1 : 0.1) + geser));

/** Pastikan hari ini hari kerja dan jam kerja standar untuk uji status. */
async function kerjakanHari() {
  const ws = await M.Workshift.findOne({ where: { hari: hariIni().hari } });
  await ws.update({ hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00', toleransi_menit: 15 });
  return ws;
}

// Set metode absensi lewat API admin (jalan lewat lapisan sungguhan)
const setMode = async (authzAdmin, metode, liveness_aktif = true) => {
  const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', authzAdmin).send({ metode, liveness_aktif });
  if (r.status !== 200) throw new Error('Gagal mengubah pengaturan: ' + JSON.stringify(r.body));
  return r;
};

const daftarWajah = (authz, em = VEK()) =>
  request(app).post('/api/face/enroll').set('Authorization', authz).send({ embedding: em, persetujuan: true });

const mintaTantangan = (authz) => request(app).post('/api/face/tantangan').set('Authorization', authz);

/** Pembimbing menayangkan QR lewat API sungguhan. */
const tayangkanQr = async (emailPmb = 'rizal@astakira.id') => {
  const authz = await tokenUntuk(emailPmb);
  const r = await request(app).post('/api/absensi/qr-tayang').set('Authorization', authz);
  if (r.status !== 201) throw new Error('Menayangkan QR gagal: ' + JSON.stringify(r.body));
  return { authz, token: r.body.token };
};

/** Peserta mengirim hasil pindaian (konfirmasi-scan). */
const konfirmasi = (authz, badan) =>
  request(app).post('/api/absensi/konfirmasi-scan').set('Authorization', authz).send(badan);

describe('menayangkan QR (/absensi/qr-tayang)', () => {
  test('peserta tidak boleh menayangkan QR pembimbing -> 403 DILARANG', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/absensi/qr-tayang').set('Authorization', authz);
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
    expect(await M.TokenPembimbing.count()).toBe(0);
  });

  test('pembimbing menayangkan ulang: token lama dipadamkan, yang baru aktif', async () => {
    const { pembimbing } = await isiDasar();
    const t1 = await tayangkanQr(pembimbing.email);
    const t2 = await tayangkanQr(pembimbing.email);

    expect(t1.token).not.toBe(t2.token);
    expect(t2.token).toHaveLength(32);
    const baris = await M.TokenPembimbing.findAll({ where: { pembimbing_id: pembimbing.id }, order: [['id', 'ASC']] });
    expect(baris).toHaveLength(2);
    const now = Date.now();
    expect(new Date(baris[0].kedaluwarsa_pada).getTime()).toBeLessThanOrEqual(now); // dipadamkan
    expect(new Date(baris[1].kedaluwarsa_pada).getTime()).toBeGreaterThan(now);
    expect(baris[1].dipakai_pada).toBeNull();
  });
});

describe('konfirmasi pindaian peserta (/absensi/konfirmasi-scan)', () => {
  test('token acak tidak punya padanan -> 404 QR_TIDAK_VALID', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    const r = await konfirmasi(authz, { token: 'XXXXXXXXadeb123456', jenis: 'masuk' });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ kode: 'QR_TIDAK_VALID' });
  });

  test('QR kedaluwarsa -> 410 QR_KEDALUWARSA', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const { token } = await tayangkanQr(pembimbing.email);
    await M.TokenPembimbing.update(
      { kedaluwarsa_pada: new Date(Date.now() - 60 * 1000) },
      { where: { pembimbing_id: pembimbing.id } },
    );
    const r = await konfirmasi(await tokenUntuk(peserta.email), { token, jenis: 'masuk' });
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ kode: 'QR_KEDALUWARSA' });
    expect(await M.Absensi.count()).toBe(0);
  });

  test('peserta bukan bimbingan pembimbing pemberi QR -> 403 BUKAN_BIMBINGAN', async () => {
    const { peserta, pembimbing } = await isiDasar();
    const pemb2 = await buatUser({ nama: 'Sinta Maharani', username: 'sinta', email: 'sinta@astakira.id', role: 'pembimbing' });
    await M.Pembimbing.create({ user_id: pemb2.id, divisi: 'Konten' });
    const bima = await buatUser({ nama: 'Bima Pratama', username: 'bima', email: 'bima@astakira.id', role: 'peserta' });
    await M.Peserta.create({ user_id: bima.id, divisi: 'Videografi', pembimbing_id: pemb2.id });

    await kerjakanHari();
    const { token } = await tayangkanQr(pembimbing.email); // QR milik rizal
    const r = await konfirmasi(await tokenUntuk(bima.email), { token, jenis: 'masuk' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'BUKAN_BIMBINGAN' });
    expect(peserta.id).toBeTruthy();
  });

  test('QR dipakai dua kali: konfirmasi kedua -> 409 QR_SUDAH_DIPAKAI', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr'); // tanpa wajah agar fokus ke token
    const { token } = await tayangkanQr(pembimbing.email);
    const authz = await tokenUntuk(peserta.email);

    const k1 = await konfirmasi(authz, { token, jenis: 'masuk' });
    expect(k1.status).toBe(200);
    const k2 = await konfirmasi(authz, { token, jenis: 'masuk' });
    expect(k2.status).toBe(409);
    expect(k2.body).toMatchObject({ kode: 'QR_SUDAH_DIPAKAI' });
    expect(await M.Absensi.count()).toBe(1);
  });

  test('dua pindaian bersamaan: tepat satu absensi tercatat', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(pembimbing.email);
    const authz = await tokenUntuk(peserta.email);

    const kiri = konfirmasi(authz, { token, jenis: 'masuk' });
    const kanan = konfirmasi(authz, { token, jenis: 'masuk' });
    const hasil = await Promise.all([kiri, kanan]);
    const kode = hasil.map((r) => [r.status, r.body.kode].join(':'));

    expect(kode.filter((k) => k.startsWith('200:')).length).toBe(1);
    expect(kode.filter((k) => k.startsWith('409:') && /(QR_SUDAH_DIPAKAI|SUDAH_ABSEN)/.test(k)).length).toBe(1);
    expect(await M.Absensi.count()).toBe(1);
  });

  test('absen pulang lewat QR ditolak (pulang lewat wajah) -> 422 PULANG_WAJAH', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr_wajah');
    const { token } = await tayangkanQr(pembimbing.email);
    const r = await konfirmasi(await tokenUntuk(peserta.email), { token, jenis: 'pulang', embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'PULANG_WAJAH' });
    // QR belum terkonsumsi — token tetap bisa dipakai untuk absen masuk
    const tok = await M.TokenPembimbing.findOne({ where: { token_hash: require('../src/utils/crypto').sha256(token) } });
    expect(tok.dipakai_pada).toBeNull();
  });

  test('hari libur -> 422 HARI_LIBUR', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const ws = await M.Workshift.findOne({ where: { hari: hariIni().hari } });
    await ws.update({ hari_kerja: false });
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(pembimbing.email);
    const r = await konfirmasi(await tokenUntuk(peserta.email), { token, jenis: 'masuk' });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'HARI_LIBUR' });
  });

  test('mode wajah: konfirmasi-scan ditolak -> 409 MODE_QR_NONAKTIF', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    const { token } = await tayangkanQr(pembimbing.email);
    const r = await konfirmasi(await tokenUntuk(peserta.email), { token, jenis: 'masuk' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'MODE_QR_NONAKTIF' });
  });

  test('mode qr_wajah: wajah cocok + nonce sah -> 200, tercatat metode QR+Wajah milik pembimbing pemberi QR', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);

    const { token } = await tayangkanQr(pembimbing.email);
    const tan = await mintaTantangan(authz);
    const r = await konfirmasi(authz, { token, jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pesan: 'Absensi tercatat.', jam: expect.any(String), status: expect.any(String) });

    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris).not.toBeNull();
    expect(baris.metode).toBe('QR+Wajah');
    expect(baris.dikonfirmasi_oleh).toBe(pembimbing.id);
    expect(baris.tanggal).toBe(hariIni().tanggal);
    // Token terkonsumsi
    const tok = await M.TokenPembimbing.findOne({ where: { token_hash: require('../src/utils/crypto').sha256(token) } });
    expect(tok.dipakai_pada).not.toBeNull();
  });

  test('mode qr_wajah: tanpa template wajah -> 412 TEMPLATE_BELUM', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    const { token } = await tayangkanQr(pembimbing.email);
    const r = await konfirmasi(authz, { token, jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(412);
    expect(r.body).toMatchObject({ kode: 'TEMPLATE_BELUM' });
  });

  test('mode qr_wajah: wajah tidak cocok -> 422 WAJAH_TIDAK_COCOK dan token tetap bisa dipakai', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz, VEK());
    const { token } = await tayangkanQr(pembimbing.email);

    const r = await konfirmasi(authz, { token, jenis: 'masuk', embedding: VEK(0.9) });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'WAJAH_TIDAK_COCOK' });

    // Kegagalan wajah terjadi sebelum token dikonsumsi, jadi token masih utuh
    const tok = await M.TokenPembimbing.findOne({ where: { token_hash: require('../src/utils/crypto').sha256(token) } });
    expect(tok.dipakai_pada).toBeNull();
  });

  test('mode qr_wajah liveness aktif: tanpa nonce -> 422 TANTANGAN_WAJIB', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const { token } = await tayangkanQr(pembimbing.email);

    const r = await konfirmasi(authz, { token, jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'TANTANGAN_WAJIB' });
  });
});

/* ---------- Aturan absen pulang ---------- */
describe('aturan absen pulang (wajah tanpa QR, dibuka 5 menit sebelum jam pulang)', () => {
  afterEach(() => waktu.__jamLepas());

  const jadwalKerja = async (jam_pulang = '16:00:00') => {
    const ws = await M.Workshift.findOne({ where: { hari: waktu.bagian().hari } });
    await ws.update({ hari_kerja: true, jam_masuk: '08:00:00', jam_pulang, toleransi_menit: 15 });
    return ws;
  };

  const absenPulangWajah = (authz, badan = {}) =>
    request(app).post('/api/absensi/wajah').set('Authorization', authz).send({ jenis: 'pulang', ...badan });

  const absenMasukQr = async (authz, pembimbingEmail) => {
    const { token } = await tayangkanQr(pembimbingEmail);
    const tan = await mintaTantangan(authz);
    const r = await konfirmasi(authz, { token, jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    if (r.status !== 200) throw new Error('Absen masuk gagal: ' + JSON.stringify(r.body));
  };

  test('pulang lewat wajah di mode qr_wajah: dibuka 15:55, tercatat metode Wajah', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await jadwalKerja();
    waktu.__jam('15:55'); // batas pembukaan persis: jam_pulang 16:00 - 5 menit
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    await absenMasukQr(authz, pembimbing.email);

    const tan = await mintaTantangan(authz);
    const r = await absenPulangWajah(authz, { embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pesan: 'Absensi tercatat.', status: 'Hadir' });

    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id, jenis: 'pulang' } });
    expect(baris).not.toBeNull();
    expect(baris.metode).toBe('Wajah');
    expect(baris.tanggal).toBe(waktu.bagian().tanggal);
    expect(baris.jam).toBe(waktu.bagian().jam);
  });

  test('pulang lebih awal dari 5 menit sebelum jam pulang -> 422 PULANG_BELUM_WAKTUNYA', async () => {
    const { peserta } = await isiDasar();
    await jadwalKerja();
    waktu.__jam('15:54'); // 1 menit sebelum pembukaan
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);

    const r = await absenPulangWajah(authz, { embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'PULANG_BELUM_WAKTUNYA' });
    expect(r.body.pesan).toContain('15:55');
    expect(await M.Absensi.count()).toBe(0);
  });

  test('peserta belum absen masuk: pulang lewat wajah -> 422 BELUM_ABSEN_MASUK', async () => {
    const { peserta } = await isiDasar();
    await jadwalKerja();
    waktu.__jam('15:56'); // dalam jendela, jadi waktu bukan penyebabnya
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);

    const r = await absenPulangWajah(authz, { embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'BELUM_ABSEN_MASUK' });
  });

  test('absen masuk lewat wajah tetap butuh metode wajah -> 409 MODE_WAJAH_NONAKTIF', async () => {
    const { peserta } = await isiDasar();
    await jadwalKerja();
    waktu.__jam('15:55');
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);

    const r = await request(app).post('/api/absensi/wajah').set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'MODE_WAJAH_NONAKTIF' });
  });
});

/* ---------- Status ditentukan server (unit murni hitungStatus) ---------- */
describe('hitungStatus (toleransi dihitung dari jam server, bukan klien)', () => {
  const ws = { jam_masuk: '08:00:00', toleransi_menit: 15 };

  test('batas toleransi: 08:15 Hadir, 08:16 Terlambat', () => {
    expect(hitungStatus('masuk', ws, { menit: menitDariJam('08:15') })).toBe('Hadir');
    expect(hitungStatus('masuk', ws, { menit: menitDariJam('08:16') })).toBe('Terlambat');
  });

  test('absen pulang selalu Hadir', () => {
    expect(hitungStatus('pulang', ws, { menit: menitDariJam('23:00') })).toBe('Hadir');
  });
});
