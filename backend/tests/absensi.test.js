const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const env = require('../src/config/env');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk } = require('./helper');
const waktu = require('../src/utils/waktu'); // mock di bawah untuk pembekuan jam uji
const { bagian, hitungStatus, menitDariJam } = require('../src/utils/waktu');
const { sha256 } = require('../src/utils/crypto');

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

/** JPEG sah palsu (magic bytes FFD8FF + isi acak) untuk foto wajah di verifikasi. */
const FOTO_B64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), require('crypto').randomBytes(24)]).toString('base64');

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

/** Peserta meminta tantangan sendiri, atau pembimbing atas nama peserta. */
const mintaTantangan = (authz, peserta_id) =>
  request(app).post('/api/face/tantangan').set('Authorization', authz).send(peserta_id ? { peserta_id } : {});

/** Peserta menayangkan QR miliknya (per jenis). */
const tayangkanQr = async (emailPeserta, jenis = 'masuk') => {
  const authz = await tokenUntuk(emailPeserta);
  const r = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis });
  if (r.status !== 201) throw new Error('Menayangkan QR gagal: ' + JSON.stringify(r.body));
  return { authz, token: r.body.token };
};

/** Pembimbing mengirim hasil pindaian QR peserta (/absensi/scan). */
const pindai = (authzPmb, badan) =>
  request(app).post('/api/absensi/scan').set('Authorization', authzPmb).send(badan);

describe('menayangkan QR (/absensi/qr-saya)', () => {
  test('pembimbing tidak boleh menayangkan QR peserta -> 403 DILARANG', async () => {
    const { pembimbing } = await isiDasar();
    const authz = await tokenUntuk(pembimbing.email);
    const r = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
    expect(await M.QrToken.count()).toBe(0);
  });

  test('peserta menayangkan ulang jenis sama: token lama dipadamkan, yang baru aktif', async () => {
    const { admin, peserta } = await isiDasar();
    await setMode(await tokenUntuk(admin.email), 'qr'); // fokus ke mekanis token
    const t1 = await tayangkanQr(peserta.email);
    const t2 = await tayangkanQr(peserta.email);

    expect(t1.token).not.toBe(t2.token);
    expect(t2.token).toHaveLength(32);
    const baris = await M.QrToken.findAll({ where: { user_id: peserta.id }, order: [['id', 'ASC']] });
    expect(baris).toHaveLength(2);
    const now = Date.now();
    expect(new Date(baris[0].kedaluwarsa_pada).getTime()).toBeLessThanOrEqual(now); // dipadamkan
    expect(new Date(baris[1].kedaluwarsa_pada).getTime()).toBeGreaterThan(now);
    expect(baris[1].dipakai_pada).toBeNull();
  });

  test('QR tiap siswa berbeda dan milik masing-masing', async () => {
    const { admin, peserta } = await isiDasar();
    await setMode(await tokenUntuk(admin.email), 'qr');
    const lain = await buatUser({ nama: 'Bima Pratama', username: 'bima', email: 'bima@astakira.id', role: 'peserta' });
    await M.Peserta.create({ user_id: lain.id, divisi: 'Videografi', pembimbing_id: null });

    const a = await tayangkanQr(peserta.email);
    const b = await tayangkanQr('bima@astakira.id');
    expect(a.token).not.toBe(b.token); // token acak per peserta
    const baris = await M.QrToken.findAll();
    const milikA = baris.find((x) => x.user_id === peserta.id);
    const milikB = baris.find((x) => x.user_id === lain.id);
    expect(milikA).toBeTruthy();
    expect(milikB).toBeTruthy();
    // QR milik orang lain tidak bisa "kena" saat dipindai: hash berbeda
    expect(milikA.token_hash).toBe(sha256(a.token));
    expect(milikB.token_hash).toBe(sha256(b.token));
    expect(milikA.token_hash).not.toBe(milikB.token_hash);
  });

  test('mode wajah: qr-saya ditolak -> 409 MODE_QR_NONAKTIF', async () => {
    const { admin, peserta } = await isiDasar();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    const r = await request(app).post('/api/absensi/qr-saya')
      .set('Authorization', await tokenUntuk(peserta.email)).send({ jenis: 'masuk' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'MODE_QR_NONAKTIF' });
  });
});

describe('pembimbing memindai QR peserta (/absensi/scan)', () => {
  test('token acak tidak punya padanan -> 404 QR_TIDAK_VALID', async () => {
    const { pembimbing } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(pembimbing.email);
    const r = await pindai(authz, { token: 'XXXXXXXXadeb123456' });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ kode: 'QR_TIDAK_VALID' });
  });

  test('QR kedaluwarsa -> 410 QR_KEDALUWARSA', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(peserta.email);
    await M.QrToken.update(
      { kedaluwarsa_pada: new Date(Date.now() - 60 * 1000) },
      { where: { user_id: peserta.id } },
    );
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ kode: 'QR_KEDALUWARSA' });
    expect(await M.Absensi.count()).toBe(0);
  });

  test('peserta tidak boleh memindai -> 403 DILARANG', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    const r = await pindai(authz, { token: 'XXXXXXXXadeb123456' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
  });

  test('QR dipakai dua kali: pindaian kedua -> 409 QR_SUDAH_DIPAKAI', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr'); // tanpa wajah agar fokus ke token
    const { token } = await tayangkanQr(peserta.email);
    const authz = await tokenUntuk(pembimbing.email);

    const k1 = await pindai(authz, { token });
    expect(k1.status).toBe(200);
    const k2 = await pindai(authz, { token });
    expect(k2.status).toBe(409);
    expect(k2.body).toMatchObject({ kode: 'QR_SUDAH_DIPAKAI' });
    expect(await M.Absensi.count()).toBe(1);
  });

  test('dua pindaian bersamaan: tepat satu absensi tercatat', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(peserta.email);
    const authz = await tokenUntuk(pembimbing.email);

    const kiri = pindai(authz, { token });
    const kanan = pindai(authz, { token });
    const hasil = await Promise.all([kiri, kanan]);
    const kode = hasil.map((r) => [r.status, r.body.kode].join(':'));

    expect(kode.filter((k) => k.startsWith('200:')).length).toBe(1);
    expect(kode.filter((k) => k.startsWith('409:') && /(QR_SUDAH_DIPAKAI|SUDAH_ABSEN)/.test(k)).length).toBe(1);
    expect(await M.Absensi.count()).toBe(1);
  });

  test('hari libur -> 422 HARI_LIBUR', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const ws = await M.Workshift.findOne({ where: { hari: hariIni().hari } });
    await ws.update({ hari_kerja: false });
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(peserta.email);
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'HARI_LIBUR' });
  });

  test('mode wajah: scan ditolak -> 409 MODE_QR_NONAKTIF', async () => {
    const { admin, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    const authzPmb = await tokenUntuk(pembimbing.email);
    // QR tidak bisa dibuat di mode wajah; pindai token apa pun tetap ditolak duluan
    const r = await pindai(authzPmb, { token: 'XXXXXXXXadeb123456' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'MODE_QR_NONAKTIF' });
  });

  test('jenis absen mengikuti token milik peserta, bukan isi body', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(peserta.email, 'masuk');
    const r = await pindai(await tokenUntuk(pembimbing.email), { token, jenis: 'pulang' });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.jenis).toBe('masuk'); // server, bukan klien, yang menentukan jenis
  });

  test('mode qr_wajah: peserta verifikasi wajah (+foto) dulu, pembimbing hanya scan token -> 200 QR+Wajah', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    const authzPsr = await tokenUntuk(peserta.email);
    await daftarWajah(authzPsr);

    // Siswa: tantangan, wajah cocok + foto JPEG dikirim dari HP-nya, lalu QR tayang
    const tan = await mintaTantangan(authzPsr);
    expect(tan.status).toBe(200);
    const v = await request(app).post('/api/face/verify').set('Authorization', authzPsr)
      .send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce, foto: FOTO_B64 });
    expect(v.status).toBe(200);

    const { token } = await tayangkanQr(peserta.email);
    // Pembimbing: hanya mengirim token hasil pindai QR
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pesan: 'Absensi tercatat.', jam: expect.any(String), status: expect.any(String) });

    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris).not.toBeNull();
    expect(baris.metode).toBe('QR+Wajah');
    expect(baris.dikonfirmasi_oleh).toBe(pembimbing.id);
    expect(baris.tanggal).toBe(hariIni().tanggal);
    // Token & verifikasi terkonsumsi
    const tok = await M.QrToken.findOne({ where: { token_hash: sha256(token) } });
    expect(tok.dipakai_pada).not.toBeNull();
    expect(tok.dipindai_oleh).toBe(pembimbing.id);
    // Verifikasi wajah peserta terkonsumsi dan dihapus fotonya
    const fV = await M.FaceVerification.findOne({ where: { user_id: peserta.id, jenis: 'masuk' } });
    expect(fV.dipakai_pada).not.toBeNull();
    expect(fV.foto_ciphertext).toBeNull();
    // Foto wajah ikut dilampirkan ke absensi
    expect(await M.WajahFoto.count({ where: { absensi_id: baris.id } })).toBe(1);

    // Admin bisa membuka foto (JPEG sah); peserta dilarang
    const authzAdm = await tokenUntuk(admin.email);
    const f = await request(app).get(`/api/admin/absensi/${baris.id}/foto`).set('Authorization', authzAdm);
    expect(f.status).toBe(200);
    expect(String(f.headers['content-type'])).toContain('image/jpeg');
    const bait = Buffer.isBuffer(f.body) ? f.body : Buffer.from(f.body);
    expect(bait.length).toBeGreaterThan(3);
    expect(bait[0]).toBe(0xff);
    expect(bait[1]).toBe(0xd8);
    const f2 = await request(app).get(`/api/admin/absensi/${baris.id}/foto`).set('Authorization', authzPsr);
    expect(f2.status).toBe(403);
  });

  test('pembimbing mana pun boleh memindai QR milik peserta bimbingan orang lain', async () => {
    const { admin, peserta } = await isiDasar();
    const pemb2 = await buatUser({ nama: 'Sinta Maharani', username: 'sinta', email: 'sinta@astakira.id', role: 'pembimbing' });
    await M.Pembimbing.create({ user_id: pemb2.id, divisi: 'Konten' });
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr'); // peserta dibimbing rizal, bukan sinta

    const { token } = await tayangkanQr(peserta.email);
    const r = await pindai(await tokenUntuk('sinta@astakira.id'), { token });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.dikonfirmasi_oleh).toBe(pemb2.id);
  });

  test('QR milik peserta nonaktif ditolak -> 404 QR_TIDAK_VALID', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr');
    const { token } = await tayangkanQr(peserta.email);
    // admin menonaktifkan peserta setelah QR tayang
    await M.User.update({ aktif: false }, { where: { id: peserta.id } });
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ kode: 'QR_TIDAK_VALID' });
  });

  const verif = async (email, jenis = 'masuk', fotoDikirim = false) => {
    const authz = await tokenUntuk(email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await request(app).post('/api/face/verify').set('Authorization', authz).send({
      jenis, embedding: VEK(), nonce: tan.body.nonce, ...(fotoDikirim ? { foto: FOTO_B64 } : {}),
    });
    if (r.status !== 200) throw new Error('Verifikasi wajah gagal: ' + JSON.stringify(r.body));
    return r;
  };

  test('mode qr_wajah: peserta belum verifikasi wajah -> QR tak bisa dibuat -> 422 WAJAH_BELUM_VERIF', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    const minta = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk' });
    expect(minta.status).toBe(422);
    expect(minta.body).toMatchObject({ kode: 'WAJAH_BELUM_VERIF' });
    expect(await M.QrToken.count()).toBe(0);
    expect(await M.Absensi.count()).toBe(0);
  });

  test('mode qr_wajah: verifikasi wajah sudah kedaluwarsa -> QR tak bisa dibuat -> 422 WAJAH_BELUM_VERIF', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    await request(app).post('/api/face/verify').set('Authorization', authz)
      .send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    // Waktu lewat: FACE_VERIFY_TTL (180 detik) dianggap lewat
    await M.FaceVerification.update(
      { kedaluwarsa_pada: new Date(Date.now() - 1000) },
      { where: { user_id: peserta.id } },
    );
    const minta = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk' });
    expect(minta.status).toBe(422);
    expect(minta.body).toMatchObject({ kode: 'WAJAH_BELUM_VERIF' });
    expect(await M.QrToken.count()).toBe(0);
  });

  test('mode qr_wajah: verifikasi jenis berbeda dari QR -> QR tak bisa dibuat -> 422 WAJAH_BELUM_VERIF', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    // Peserta memverifikasi diri untuk jenis pulang, tetapi QR yang diminta jenis masuk
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    await request(app).post('/api/face/verify').set('Authorization', authz)
      .send({ jenis: 'pulang', embedding: VEK(), nonce: tan.body.nonce });

    const minta = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk' });
    expect(minta.status).toBe(422);
    expect(minta.body).toMatchObject({ kode: 'WAJAH_BELUM_VERIF' });
    expect(await M.QrToken.count()).toBe(0);
  });

  test('mode qr_wajah: verifikasi yang sudah dipakai tidak bisa mengenali pindaian berikutnya', async () => {
    const { peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await verif(peserta.email);
    const { token } = await tayangkanQr(peserta.email);
    const k1 = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(k1.status).toBe(200);
    expect(await M.Absensi.count()).toBe(1);

    // QR jenis sama dicoba ditayang lagi: slot absen hari ini sudah terisi -> SUDAH_ABSEN
    const minta = await request(app)
      .post('/api/absensi/qr-saya')
      .set('Authorization', await tokenUntuk(peserta.email))
      .send({ jenis: 'masuk' });
    expect(minta.status).toBe(409);
    expect(minta.body).toMatchObject({ kode: 'SUDAH_ABSEN' });
  });

  test('mode wajah: /absensi/wajah dengan foto -> foto dilampirkan ke absensi', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await request(app).post('/api/absensi/wajah').set('Authorization', authz)
      .send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce, foto: FOTO_B64 });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.metode).toBe('Wajah');
    expect(await M.WajahFoto.count({ where: { absensi_id: baris.id } })).toBe(1);

    // Absensi tanpa foto (baris lain, mis. metode QR) -> admin mendapat 404 FOTO_ABSEN_TAK_ADA
    const baris2 = await M.Absensi.create({ user_id: pembimbing.id, tanggal: hariIni().tanggal, jenis: 'masuk', jam: '09:00', status: 'Hadir', metode: 'QR' });
    const f = await request(app).get(`/api/admin/absensi/${baris2.id}/foto`)
      .set('Authorization', await tokenUntuk(admin.email));
    expect(f.status).toBe(404);
    expect(f.body).toMatchObject({ kode: 'FOTO_ABSEN_TAK_ADA' });
  });
});

/* ---------- Aturan waktu absen pulang lewat scan QR ---------- */
describe('aturan absen pulang lewat scan (dibuka 5 menit sebelum jam pulang)', () => {
  afterEach(() => waktu.__jamLepas());

  const jadwalKerja = async (jam_pulang = '16:00:00') => {
    const ws = await M.Workshift.findOne({ where: { hari: waktu.bagian().hari } });
    await ws.update({ hari_kerja: true, jam_masuk: '08:00:00', jam_pulang, toleransi_menit: 15 });
    return ws;
  };

  const scanMasuk = async (peserta, authzPmb) => {
    const { token } = await tayangkanQr(peserta.email, 'masuk');
    const r = await pindai(authzPmb, { token });
    if (r.status !== 200) throw new Error('Absen masuk gagal: ' + JSON.stringify(r.body));
  };

  test('absen pulang via scan: dibuka 15:55, tercatat pulang_status Hadir di baris masuk', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await jadwalKerja();
    await setMode(await tokenUntuk(admin.email), 'qr');
    waktu.__jam('15:55'); // batas pembukaan persis: jam_pulang 16:00 - 5 menit
    await scanMasuk(peserta, await tokenUntuk(pembimbing.email));

    const { token } = await tayangkanQr(peserta.email, 'pulang');
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pesan: 'Absensi tercatat.', status: 'Hadir' });

    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris).not.toBeNull();
    expect(baris.metode).toBe('QR');
    expect(baris.tanggal).toBe(waktu.bagian().tanggal);
    expect(baris.jam).toBe(waktu.bagian().jam);
    // Satu baris per hari: pulang tersimpan di kolom pulang, status masuk tak tersentuh
    expect(baris.pulang_jam).toBe(waktu.bagian().jam);
    expect(baris.pulang_status).toBe('Hadir');
    expect(baris.jenis).toBe('masuk');

    // Tayang ulang QR pulang setelah pulang tercatat ditolak — QR tidak boleh
    // tayang lagi (sebelumnya tetap tayang lalu ditolak di pemindai, membingungkan)
    const ulang = await request(app)
      .post('/api/absensi/qr-saya')
      .set('Authorization', await tokenUntuk(peserta.email))
      .send({ jenis: 'pulang' });
    expect(ulang.status).toBe(409);
    expect(ulang.body).toMatchObject({ kode: 'SUDAH_ABSEN' });
  });

  test('pindai QR pulang lebih awal dari 5 menit sebelum jam pulang -> 422 PULANG_BELUM_WAKTUNYA', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await jadwalKerja();
    await setMode(await tokenUntuk(admin.email), 'qr'); // fokus ke aturan waktu, bukan wajah
    waktu.__jam('15:54'); // 1 menit sebelum pembukaan
    const { token } = await tayangkanQr(peserta.email, 'pulang');
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'PULANG_BELUM_WAKTUNYA' });
    expect(r.body.pesan).toContain('15:55');
    expect(await M.Absensi.count()).toBe(0);
  });

  test('peserta belum absen masuk: pindai QR pulang -> 422 BELUM_ABSEN_MASUK', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await jadwalKerja();
    await setMode(await tokenUntuk(admin.email), 'qr');
    waktu.__jam('15:56'); // dalam jendela, jadi waktu bukan penyebabnya
    const { token } = await tayangkanQr(peserta.email, 'pulang');
    const r = await pindai(await tokenUntuk(pembimbing.email), { token });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'BELUM_ABSEN_MASUK' });
  });

  test('/absensi/wajah saat mode qr -> 409 MODE_WAJAH_NONAKTIF', async () => {
    const { admin, peserta } = await isiDasar();
    await jadwalKerja();
    waktu.__jam('15:55');
    await setMode(await tokenUntuk(admin.email), 'qr');
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const r = await request(app).post('/api/absensi/wajah').set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'MODE_WAJAH_NONAKTIF' });
  });
});

/* ---------- Telat sungguhan setelah penanda otomatis "Tidak hadir" ---------- */
describe('penanda otomatis Tidak hadir diganti absensi sungguhan', () => {
  afterEach(() => waktu.__jamLepas());

  const penanda = (peserta) => M.Absensi.create({
    user_id: peserta.id, tanggal: waktu.bagian().tanggal, jenis: 'masuk',
    jam: '00:00:00', status: 'Tidak hadir', metode: 'Otomatis',
  });

  test('absen masuk wajah mengganti penanda: Terlambat, tetap satu baris', async () => {
    const { admin, peserta } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    waktu.__jam('09:00'); // lewat toleransi 08:15
    await penanda(peserta);
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await request(app).post('/api/absensi/wajah').set('Authorization', authz)
      .send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Terlambat');
    expect(r.body.jam.slice(0, 5)).toBe('09:00');
    const baris = await M.Absensi.findAll({ where: { user_id: peserta.id, tanggal: hariIni().tanggal } });
    expect(baris).toHaveLength(1);
    expect(baris[0].metode).toBe('Wajah');
    expect(baris[0].status).toBe('Terlambat');
  });

  test('absen pulang ditolak bila masuk masih penanda otomatis', async () => {
    const { admin, peserta } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    waktu.__jam('16:00');
    await penanda(peserta);
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await request(app).post('/api/absensi/wajah').set('Authorization', authz)
      .send({ jenis: 'pulang', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(422);
    expect(r.body.kode).toBe('BELUM_ABSEN_MASUK');
    expect(await M.Absensi.count({ where: { user_id: peserta.id, jenis: 'pulang' } })).toBe(0);
  });

  test('QR: penanda tidak memblokir tayang, pindaian mengganti penanda', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await kerjakanHari();
    await setMode(await tokenUntuk(admin.email), 'qr');
    waktu.__jam('09:00');
    await penanda(peserta);
    const authz = await tokenUntuk(peserta.email);
    const minta = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk' });
    expect(minta.status).toBe(201); // penanda otomatis bukan SUDAH_ABSEN
    const r = await pindai(await tokenUntuk(pembimbing.email), { token: minta.body.token });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findAll({ where: { user_id: peserta.id, tanggal: hariIni().tanggal } });
    expect(baris).toHaveLength(1);
    expect(baris[0].metode).toBe('QR');
    expect(baris[0].status).toBe('Terlambat');

    // Penanda sudah diganti absensi nyata: tayang ulang ditolak seperti biasa
    const minta2 = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk' });
    expect(minta2.status).toBe(409);
    expect(minta2.body.kode).toBe('SUDAH_ABSEN');
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
