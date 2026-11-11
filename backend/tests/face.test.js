const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const env = require('../src/config/env');
const { kosongkanDb, isiDasar, tokenUntuk } = require('./helper');
const { bagian } = require('../src/utils/waktu');
const { sha256 } = require('../src/utils/crypto');

beforeEach(kosongkanDb);

/* ---------- Alat bantu ---------- */

// Embedding dik = dimensi dari env; vektor tetap agar deterministik.
const VEK = (geser = 0) => Array.from({ length: env.face.dim }, (_, i) => ((i % 2 ? -0.1 : 0.1) + geser));

const daftarWajah = async (authz, em = VEK()) =>
  (await request(app).post('/api/face/enroll').set('Authorization', authz).send({ embedding: em, persetujuan: true }));

const mintaTantangan = async (authz) =>
  (await request(app).post('/api/face/tantangan').set('Authorization', authz));

const verifikasi = async (authz, badan) =>
  (await request(app).post('/api/face/verify').set('Authorization', authz).send(badan));

// Set metode absensi lewat API admin (jalan lewat lapisan sungguhan)
const setMode = async (authzAdmin, metode, liveness_aktif = true) => {
  const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', authzAdmin).send({ metode, liveness_aktif });
  if (r.status !== 200) throw new Error('Gagal mengubah pengaturan: ' + JSON.stringify(r.body));
  return r;
};

/** Pastikan hari ini kerja jam kerja standar (08:00, toleransi 15). */
async function kerjakanHari() {
  const ws = await M.Workshift.findOne({ where: { hari: bagian().hari } });
  await ws.update({ hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00', toleransi_menit: 15 });
}

/* ---------- Pendaftaran wajah (/face/enroll) ---------- */
describe('pendaftaran wajah (/face/enroll)', () => {
  test('tanpa persetujuan -> 422 PERSETUJUAN_WAJIB', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/face/enroll').set('Authorization', authz).send({ embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'PERSETUJUAN_WAJIB' });
    expect(await M.FaceTemplate.count()).toBe(0);
  });

  test('dengan persetujuan -> 201 dan waktu persetujuan tercatat', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await daftarWajah(authz);
    expect(r.status).toBe(201);
    const tpl = await M.FaceTemplate.findOne({ where: { user_id: peserta.id } });
    expect(tpl).not.toBeNull();
    expect(tpl.disetujui_pada).not.toBeNull();
  });

  test('template kedua -> 409 TEMPLATE_ADA', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const r = await daftarWajah(authz);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'TEMPLATE_ADA' });
  });
});

/* ---------- Status pendaftaran wajah (/face/template) ---------- */
describe('status template (/face/template)', () => {
  test('belum mendaftar -> terdaftar: false', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).get('/api/face/template').set('Authorization', authz);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ terdaftar: false });
  });

  test('setelah enroll -> terdaftar: true; pembimbing dilarang memanggil', async () => {
    const { peserta, pembimbing } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const r = await request(app).get('/api/face/template').set('Authorization', authz);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ terdaftar: true });

    const r2 = await request(app).get('/api/face/template').set('Authorization', await tokenUntuk(pembimbing.email));
    expect(r2.status).toBe(403);
  });
});

/* ---------- Verifikasi wajah + liveness (/face/verify) ---------- */
describe('verifikasi wajah (/face/verify)', () => {
  test('wajah cocok + tantangan sah -> 200 dan verifikasi tercatat', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    expect(tan.status).toBe(200);
    expect(tan.body).toMatchObject({ nonce: expect.any(String), instruksi: expect.any(String) });

    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(200);
    expect(await M.FaceVerification.count({ where: { user_id: peserta.id, jenis: 'masuk', dipakai_pada: null } })).toBe(1);
  });

  test('hari tercatat Izin/Sakit -> 409 HARI_TERCATAT sebelum wajah dibandingkan', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    // Izin hari ini sudah disetujui (baris absensi metode Izin menempati slot harian)
    await M.Absensi.create({
      user_id: peserta.id, tanggal: bagian().tanggal, jenis: 'masuk', jam: bagian().jam,
      status: 'Izin', metode: 'Izin', keterangan: 'Acara keluarga.',
    });

    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'HARI_TERCATAT' });
    // Verifikasi tidak tercatat dan tantangan tidak ikut terkonsumsi
    expect(await M.FaceVerification.count()).toBe(0);
    expect(await M.TantanganWajah.findOne({ where: { user_id: peserta.id } })).not.toBeNull();
  });

  test('wajah tidak cocok -> 422 WAJAH_TIDAK_COCOK', async () => {    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz, VEK());
    const tan = await mintaTantangan(authz);
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(0.9), nonce: tan.body.nonce });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'WAJAH_TIDAK_COCOK' });
    expect(await M.FaceVerification.count()).toBe(0);
  });

  test('wajah tidak terbaca (bentuk salah) -> 422 WAJAH_TIDAK_TERBACA', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: [0.1, 0.2], nonce: tan.body.nonce });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'WAJAH_TIDAK_TERBACA' });
  });

  test('liveness aktif tanpa nonce -> 422 TANTANGAN_WAJIB', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'TANTANGAN_WAJIB' });
  });

  test('tantangan kedaluwarsa -> 410 TANTANGAN_KEDALUWARSA', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    await M.TantanganWajah.create({
      user_id: peserta.id,
      nonce_hash: sha256('NONCE-KEDALUWARSA'),
      kode_gerakan: 'kedip',
      kedaluwarsa_pada: new Date(Date.now() - 30 * 1000),
    });
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: 'NONCE-KEDALUWARSA' });
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ kode: 'TANTANGAN_KEDALUWARSA' });
  });

  test('tantangan dipakai ulang -> 409 TANTANGAN_SUDAH', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);

    const r1 = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r1.status).toBe(200);

    const r2 = await verifikasi(authz, { jenis: 'pulang', embedding: VEK(), nonce: tan.body.nonce });
    expect(r2.status).toBe(409);
    expect(r2.body).toMatchObject({ kode: 'TANTANGAN_SUDAH' });
  });

  test('tantangan milik peserta lain -> 404 TANTANGAN_TAK_ADA', async () => {
    const { peserta, pembimbing } = await isiDasar();
    const authzAlya = await tokenUntuk(peserta.email);
    await daftarWajah(authzAlya);
    const tan = await mintaTantangan(authzAlya); // milik alya

    // Peserta kedua dengan template sendiri mencoba nonce milik alya
    const bima = await (require('./helper').buatUser)({ nama: 'Bima Pratama', username: 'bima', email: 'bima@astakira.id', role: 'peserta' });
    await M.Peserta.create({ user_id: bima.id, divisi: 'Videografi', pembimbing_id: pembimbing.id });
    const authzBima = await tokenUntuk(bima.email);
    await daftarWajah(authzBima);

    const r = await verifikasi(authzBima, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ kode: 'TANTANGAN_TAK_ADA' });
  });
});

/* ---------- Liveness dipadamkan oleh admin ---------- */
describe('verifikasi tanpa liveness (liveness_aktif=false)...', () => {
  test('tanpa nonce -> 200 (liveness dibebas admin)', async () => {
    const { admin, peserta } = await isiDasar();
    const authzAdmin = await tokenUntuk(admin.email);
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    await setMode(authzAdmin, 'qr_wajah', false);

    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(200);
    expect(await M.FaceVerification.count()).toBe(1);
  });
});

/* ---------- Foto wajah pada verifikasi (/face/verify) ---------- */
describe('foto wajah pada verifikasi (/face/verify)', () => {
  /** JPEG sah palsu (magic bytes FFD8FF + isi acak). */
  const JPEG_B64 = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff]),
    require('crypto').randomBytes(24),
  ]).toString('base64');

  test('verifikasi dengan foto JPEG -> tersimpan terenkripsi pada verifikasi', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce, foto: JPEG_B64 });
    expect(r.status).toBe(200);
    const fV = await M.FaceVerification.findOne({ where: { user_id: peserta.id } });
    expect(fV).not.toBeNull();
    // 3 bagian base64 dipisah titik (iv.tag.ct) — bukan base64 JPEG polos
    expect(fV.foto_ciphertext).toMatch(/^[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*$/);
  });

  test('verifikasi tanpa foto -> foto_ciphertext null (sah)', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(200);
    const fV = await M.FaceVerification.findOne();
    expect(fV.foto_ciphertext).toBeNull();
  });

  test('foto bukan JPEG -> 422 FOTO_BUKAN_JPEG', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await verifikasi(authz, {
      jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce,
      foto: Buffer.from('PNG bukan JPEG').toString('base64'),
    });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'FOTO_BUKAN_JPEG' });
    expect(await M.FaceVerification.count()).toBe(0); // wajah cocok tapi foto ditolak
  });

  test('foto terlalu besar -> 422 FOTO_TERLALU_BESAR', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const gemuk = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), require('crypto').randomBytes(env.face.foto.maksBait + 100)]).toString('base64');
    const r = await verifikasi(authz, { jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce, foto: gemuk });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'FOTO_TERLALU_BESAR' });
  });
});

/* ---------- Tantangan hanya milik peserta ---------- */
describe('tantangan liveness khusus peserta (/face/tantangan)', () => {
  test('pembimbing tidak diperbolehkan meminta tantangan -> 403 DILARANG', async () => {
    const { pembimbing } = await isiDasar();
    const r = await request(app).post('/api/face/tantangan')
      .set('Authorization', await tokenUntuk(pembimbing.email))
      .send({ peserta_id: 1 });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
  });
});

/* ---------- Tiga mode absensi ---------- */
describe('mode absensi (pengaturan_absensi)', () => {
  test('mode qr: scan tanpa verifikasi wajah -> 200, tercatat metode QR', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    const authzAdmin = await tokenUntuk(admin.email);
    await kerjakanHari();
    await setMode(authzAdmin, 'qr');

    const tayang = await request(app)
      .post('/api/absensi/qr-saya')
      .set('Authorization', await tokenUntuk(peserta.email))
      .send({ jenis: 'masuk' });
    expect(tayang.status).toBe(201);
    const r = await request(app)
      .post('/api/absensi/scan')
      .set('Authorization', await tokenUntuk(pembimbing.email))
      .send({ token: tayang.body.token });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.metode).toBe('QR');
    expect(baris.dikonfirmasi_oleh).toBe(pembimbing.id);
  });

  test('mode qr_wajah: peserta belum verifikasi wajah -> QR tak bisa dibuat -> 422 WAJAH_BELUM_VERIF', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    const minta = await request(app)
      .post('/api/absensi/qr-saya')
      .set('Authorization', await tokenUntuk(peserta.email))
      .send({ jenis: 'masuk' });
    expect(minta.status).toBe(422);
    expect(minta.body).toMatchObject({ kode: 'WAJAH_BELUM_VERIF' });
    expect(await M.QrToken.count()).toBe(0);
  });

  test('mode wajah: scan & qr-saya ditolak -> 409 MODE_QR_NONAKTIF; /absensi/wajah tercatat metode Wajah', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    const authzAdmin = await tokenUntuk(admin.email);
    const authz = await tokenUntuk(peserta.email);
    await kerjakanHari();
    await setMode(authzAdmin, 'wajah');
    await daftarWajah(authz);

    // QR tak bisa dibuat di mode wajah...
    const tayang = await request(app)
      .post('/api/absensi/qr-saya')
      .set('Authorization', authz)
      .send({ jenis: 'masuk' });
    expect(tayang.status).toBe(409);
    // ...dan pindaian apa pun ditolak sebelum mencocokkan token
    const qr = await request(app)
      .post('/api/absensi/scan')
      .set('Authorization', await tokenUntuk(pembimbing.email))
      .send({ token: 'XXXXXXXXadeb123456' });
    expect(qr.status).toBe(409);
    expect(qr.body).toMatchObject({ kode: 'MODE_QR_NONAKTIF' });

    const tan = await mintaTantangan(authz);
    const r = await request(app).post('/api/absensi/wajah')
      .set('Authorization', authz)
      .send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.metode).toBe('Wajah');
    expect(baris.tanggal).toBe(bagian().tanggal);
    expect(r.body.jam.slice(0, 5)).toBe(baris.jam.slice(0, 5));
  });

  test('mode wajah: absen ganda -> 409 SUDAH_ABSEN', async () => {
    const { admin, peserta } = await isiDasar();
    const authzAdmin = await tokenUntuk(admin.email);
    const authz = await tokenUntuk(peserta.email);
    await kerjakanHari();
    await setMode(authzAdmin, 'wajah');
    await daftarWajah(authz);

    const tan1 = await mintaTantangan(authz);
    const r1 = await request(app).post('/api/absensi/wajah')
      .set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK(), nonce: tan1.body.nonce });
    expect(r1.status).toBe(200);

    const tan2 = await mintaTantangan(authz);
    const r2 = await request(app).post('/api/absensi/wajah')
      .set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK(), nonce: tan2.body.nonce });
    expect(r2.status).toBe(409);
    expect(r2.body).toMatchObject({ kode: 'SUDAH_ABSEN' });
  });

  test('mode wajah: tanpa nonce saat liveness aktif -> 422 TANTANGAN_WAJIB', async () => {
    const { admin, peserta } = await isiDasar();
    const authzAdmin = await tokenUntuk(admin.email);
    const authz = await tokenUntuk(peserta.email);
    await kerjakanHari();
    await setMode(authzAdmin, 'wajah');
    await daftarWajah(authz);

    const r = await request(app).post('/api/absensi/wajah')
      .set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK() });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'TANTANGAN_WAJIB' });
  });

  test('/absensi/wajah saat mode qr_wajah -> 409 MODE_WAJAH_NONAKTIF', async () => {
    const { peserta } = await isiDasar();
    await kerjakanHari();
    const authz = await tokenUntuk(peserta.email);
    await daftarWajah(authz);
    const tan = await mintaTantangan(authz);
    const r = await request(app).post('/api/absensi/wajah')
      .set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'MODE_WAJAH_NONAKTIF' });
  });
});

/* ---------- Endpoint pengaturan (admin) ---------- */
describe('pengaturan absensi (/pengaturan/absensi)', () => {
  test('peserta boleh membaca, admin membaca default', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).get('/api/pengaturan/absensi').set('Authorization', authz);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ metode: 'qr_wajah', liveness_aktif: true });
  });

  test('peserta memaksa perubahan -> 403 DILARANG', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', authz).send({ metode: 'qr' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
  });

  test('metode tidak dikenal -> 400 VALIDASI', async () => {
    const { admin } = await isiDasar();
    const authz = await tokenUntuk(admin.email);
    const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', authz).send({ metode: 'retina' });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ kode: 'VALIDASI' });
  });

  test('ubah metode dan liveness -> tersimpan dan masuk audit log', async () => {
    const { admin } = await isiDasar();
    const authz = await tokenUntuk(admin.email);
    const r = await setMode(authz, 'wajah', false);
    expect(r.body.pengaturan).toMatchObject({ metode: 'wajah', liveness_aktif: false });
    const log = await M.AuditLog.findOne({ where: { aksi: 'Ubah pengaturan absensi' } });
    expect(log).not.toBeNull();
  });
});

/* ---------- Penonaktifan akun membersihkan data wajah ---------- */
describe('akun dinonaktifkan -> data wajah bersih', () => {
  test('admin menonaktifkan peserta: template, verifikasi, tantangan hilang', async () => {
    const { admin, peserta } = await isiDasar();
    const authzAdmin = await tokenUntuk(admin.email);
    const authzPsr = await tokenUntuk(peserta.email);
    await daftarWajah(authzPsr);
    await mintaTantangan(authzPsr);
    expect(await M.FaceTemplate.count()).toBe(1);

    const r = await request(app).put(`/api/admin/peserta/${peserta.id}`).set('Authorization', authzAdmin).send({ aktif: false });
    expect(r.status).toBe(200);

    expect(await M.FaceTemplate.count()).toBe(0);
    expect(await M.FaceVerification.count()).toBe(0);
    expect(await M.TantanganWajah.count()).toBe(0);
  });
});
