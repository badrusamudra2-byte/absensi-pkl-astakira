const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const env = require('../src/config/env');
const { kosongkanDb, isiDasar, tokenUntuk } = require('./helper');
const waktu = require('../src/utils/waktu'); // mock untuk pembekuan jam uji
const { bagian } = require('../src/utils/waktu');
const { jarakMeter, bacaLokasi, sahkanLokasi } = require('../src/utils/lokasi');

// Waktu "sekarang" dibekukan lewat bagian() (pola sama dengan absensi.test.js)
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

beforeEach(kosongkanDb);

/** Hari-jam menurut zona aplikasi (harus sama dengan src/utils/waktu.js) */
const hariIni = () => bagian();

const hariKerja = async () => {
  const ws = await M.Workshift.findOne({ where: { hari: hariIni().hari } });
  await ws.update({ hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00', toleransi_menit: 15 });
};

// Kantor uji: pusat monas-ish; +0.0009° lat = ±100 m
const KANTOR = { lat_kantor: -6.2, lng_kantor: 106.816, radius_m: 150, akurasi_maks_m: 50 };
const DI_DALAM = { lat: -6.2, lng: 106.816, akurasi_m: 20 };
const LUAR = { lat: -6.21, lng: 106.816, akurasi_m: 20 }; // ±1112 m

const setKantor = async (authzAdmin, isi = KANTOR) => {
  const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', authzAdmin).send(isi);
  if (r.status !== 200) throw new Error('Gagal set pengaturan kantor: ' + JSON.stringify(r.body));
  return r;
};

const setMode = async (authzAdmin, metode) => {
  const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', authzAdmin).send({ metode });
  if (r.status !== 200) throw new Error('Gagal mengubah metode: ' + JSON.stringify(r.body));
};

const VEK = () => Array.from({ length: env.face.dim }, (_, i) => (i % 2 ? -0.1 : 0.1));

/* ---------- Unit murni: Haversine & validasi ---------- */
describe('utils/lokasi (unit)', () => {
  test('jarakMeter: jarak kecil dan besar masuk akal', () => {
    expect(jarakMeter(-6.2, 106.816, -6.2, 106.816)).toBe(0);
    const seratusMeter = jarakMeter(-6.2, 106.816, -6.1991, 106.816);
    expect(seratusMeter).toBeGreaterThan(95);
    expect(seratusMeter).toBeLessThan(105);
    const kilometer = jarakMeter(-6.2, 106.816, -6.21, 106.816);
    expect(kilometer).toBeGreaterThan(1000);
    expect(kilometer).toBeLessThan(1200);
  });

  test('bacaLokasi: null bila tidak dikirim; galat VALIDASI bila di luar rentang', () => {
    expect(bacaLokasi({})).toBeNull();
    expect(bacaLokasi({ lat: -6.2, lng: 106.816 })).toEqual({ lat: -6.2, lng: 106.816, akurasi_m: null });
    expect(() => bacaLokasi({ lat: 91, lng: 0 })).toThrow();
    let err;
    try { bacaLokasi({ lat: -6.2, lng: 200 }); } catch (e) { err = e; }
    expect(err.status).toBe(400);
    expect(err.kode).toBe('VALIDASI');
    try { bacaLokasi({ lat: -6.2, lng: 106.816, akurasi_m: -1 }); } catch (e) { err = e; }
    expect(err.kode).toBe('VALIDASI');
  });

  test('sahkanLokasi: kantor belum diatur -> {} tanpa menuntut lokasi', () => {
    expect(sahkanLokasi({}, null)).toEqual({});
    expect(sahkanLokasi({ lat_kantor: null, lng_kantor: null, radius_m: 100, akurasi_maks_m: 50 }, { lat: 0, lng: 0, akurasi_m: 10 })).toEqual({});
  });

  test('sahkanLokasi: dalam radius -> jarak_m & di_dalam_area; luar & akurasi buruk -> 422', () => {
    const cfg = { lat_kantor: -6.2, lng_kantor: 106.816, radius_m: 150, akurasi_maks_m: 50 };
    const ok = sahkanLokasi(cfg, { lat: -6.1999, lng: 106.816, akurasi_m: 20 });
    expect(ok.di_dalam_area).toBe(true);
    expect(ok.jarak_m).toBeLessThanOrEqual(150);
    expect(ok.lat).toBe(-6.1999);

    let err;
    try { sahkanLokasi(cfg, null); } catch (e) { err = e; }
    expect(err.status).toBe(422);
    expect(err.kode).toBe('LOKASI_DIBUTUHKAN');

    try { sahkanLokasi(cfg, { lat: -6.21, lng: 106.816, akurasi_m: 10 }); } catch (e) { err = e; }
    expect(err.status).toBe(422);
    expect(err.kode).toBe('DI_LUAR_RADIUS');

    try { sahkanLokasi(cfg, { lat: -6.2, lng: 106.816, akurasi_m: 80 }); } catch (e) { err = e; }
    expect(err.status).toBe(422);
    expect(err.kode).toBe('AKURASI_BURUK');
  });
});

/* ---------- API: pengaturan kantor ---------- */
describe('pengaturan lokasi kantor (/pengaturan/absensi)', () => {
  test('admin menyimpan dan membaca lat/lng/radius/akurasi', async () => {
    const { admin } = await isiDasar();
    const authz = await tokenUntuk(admin.email);
    const r = await setKantor(authz);
    expect(r.body.pengaturan).toMatchObject({ lat_kantor: KANTOR.lat_kantor, radius_m: 150, akurasi_maks_m: 50 });
    const lihat = await request(app).get('/api/pengaturan/absensi').set('Authorization', authz);
    expect(lihat.body).toMatchObject({ lat_kantor: KANTOR.lat_kantor, lng_kantor: KANTOR.lng_kantor });

    // Audit log tercatat
    const au = await request(app).get('/api/admin/audit').set('Authorization', authz);
    expect(au.body.data.some((x) => x.aksi === 'Ubah pengaturan absensi' && x.target && x.target.includes('lat_kantor'))).toBe(true);
  });

  test('peserta tidak boleh mengubah pengaturan -> 403 DILARANG', async () => {
    const { peserta } = await isiDasar();
    const r = await request(app).put('/api/pengaturan/absensi').set('Authorization', await tokenUntuk(peserta.email)).send(KANTOR);
    expect(r.status).toBe(403);
  });

  test('validasi: koordinat di luar rentang, radius/akurasi tidak bulat, pasangan tidak lengkap', async () => {
    const { admin } = await isiDasar();
    const authz = await tokenUntuk(admin.email);
    const kirim = (b) => request(app).put('/api/pengaturan/absensi').set('Authorization', authz).send(b);
    expect((await kirim({ lat_kantor: 95, lng_kantor: 106 })).status).toBe(400);
    expect((await kirim({ lat_kantor: -6.2, lng_kantor: 200 })).status).toBe(400);
    expect((await kirim({ radius_m: 5 })).status).toBe(400);
    expect((await kirim({ akurasi_maks_m: 0 })).status).toBe(400);
    expect((await kirim({ lat_kantor: -6.2 })).status).toBe(400); // tanpa pasangan lng
    // radius lebih kecil dari ambang akurasi: GPS tak mungkin lolos
    expect((await kirim({ lat_kantor: -6.2, lng_kantor: 106.816, radius_m: 20, akurasi_maks_m: 50 })).status).toBe(400);
    // koordinat null diizinkan (nonaktif) tapi harus berpasangan
    expect((await setKantor(authz)).status).toBe(200); // pasangan lengkap tersimpan
    expect((await kirim({ lat_kantor: null })).status).toBe(400); // buang satu sisi saja
    expect((await kirim({ lat_kantor: null, lng_kantor: null })).status).toBe(200); // nonaktif berpasangan
  });
});

/* ---------- API: absen wajah dengan lokasi ---------- */
describe('absen wajah dengan validasi lokasi', () => {
  afterEach(() => waktu.__jamLepas());

  const siapWajah = async (peserta) => {
    const authz = await tokenUntuk(peserta.email);
    await request(app).post('/api/face/enroll').set('Authorization', authz).send({ embedding: VEK(), persetujuan: true });
    const tan = await request(app).post('/api/face/tantangan').set('Authorization', authz);
    return { authz, nonce: tan.body.nonce };
  };

  const absenWajah = (authz, badan) =>
    request(app).post('/api/absensi/wajah').set('Authorization', authz).send({ jenis: 'masuk', embedding: VEK(), ...badan });

  test('kantor belum diatur: absen tanpa lokasi tetap sah (alur lama tidak berubah)', async () => {
    const { admin, peserta } = await isiDasar();
    await hariKerja();
    await setMode(await tokenUntuk(admin.email), 'wajah');
    waktu.__jam('08:00');
    const { authz, nonce } = await siapWajah(peserta);
    const r = await absenWajah(authz, { nonce });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.lat).toBeNull();
    expect(baris.di_dalam_area).toBeNull();
  });

  test('dalam radius: tersimpan lat/lng/jarak_m/di_dalam_area', async () => {
    const { admin, peserta } = await isiDasar();
    await hariKerja();
    const authzAdm = await tokenUntuk(admin.email);
    await setMode(authzAdm, 'wajah');
    await setKantor(authzAdm);
    waktu.__jam('08:00');
    const { authz, nonce } = await siapWajah(peserta);
    const r = await absenWajah(authz, { nonce, ...DI_DALAM });
    expect(r.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.lat).toBe(DI_DALAM.lat);
    expect(baris.lng).toBe(DI_DALAM.lng);
    expect(baris.di_dalam_area).toBe(true);
    expect(baris.jarak_m).toBeLessThanOrEqual(KANTOR.radius_m);
  });

  test('tanpa lokasi -> 422 LOKASI_DIBUTUHKAN; di luar radius -> 422 DI_LUAR_RADIUS; akurasi buruk -> 422 AKURASI_BURUK', async () => {
    const { admin, peserta } = await isiDasar();
    await hariKerja();
    const authzAdm = await tokenUntuk(admin.email);
    await setMode(authzAdm, 'wajah');
    await setKantor(authzAdm);
    waktu.__jam('08:00');
    const { authz, nonce } = await siapWajah(peserta);

    const a = await absenWajah(authz, { nonce });
    expect(a.status).toBe(422);
    expect(a.body).toMatchObject({ kode: 'LOKASI_DIBUTUHKAN' });
    expect(await M.Absensi.count()).toBe(0);

    const b = await absenWajah(authz, { nonce, ...LUAR });
    expect(b.status).toBe(422);
    expect(b.body).toMatchObject({ kode: 'DI_LUAR_RADIUS' });
    expect(await M.Absensi.count()).toBe(0);

    const c = await absenWajah(authz, { nonce, lat: DI_DALAM.lat, lng: DI_DALAM.lng, akurasi_m: 200 });
    expect(c.status).toBe(422);
    expect(c.body).toMatchObject({ kode: 'AKURASI_BURUK' });
    expect(await M.Absensi.count()).toBe(0);

    // Koordinat tak wajar ditolak VALIDASI
    const d = await absenWajah(authz, { nonce, lat: 999, lng: DI_DALAM.lng });
    expect(d.status).toBe(400);
    expect(d.body).toMatchObject({ kode: 'VALIDASI' });
  });
});

/* ---------- API: QR dengan lokasi peserta ---------- */
describe('QR: lokasi dikumpulkan saat qr-saya, dipakai saat scan', () => {
  afterEach(() => waktu.__jamLepas());

  const tayang = async (peserta, lokasi = {}) => {
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/absensi/qr-saya').set('Authorization', authz).send({ jenis: 'masuk', ...lokasi });
    return r;
  };

  test('qr-saya di luar radius ditolak; dalam radius tersimpan di token dan absensi', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await hariKerja();
    const authzAdm = await tokenUntuk(admin.email);
    await setMode(authzAdm, 'qr');
    await setKantor(authzAdm);
    waktu.__jam('08:00');

    const tolak = await tayang(peserta, LUAR);
    expect(tolak.status).toBe(422);
    expect(tolak.body).toMatchObject({ kode: 'DI_LUAR_RADIUS' });
    expect(await M.QrToken.count()).toBe(0);

    const tanpaLok = await tayang(peserta);
    expect(tanpaLok.status).toBe(422);
    expect(tanpaLok.body).toMatchObject({ kode: 'LOKASI_DIBUTUHKAN' });

    const ok = await tayang(peserta, DI_DALAM);
    expect(ok.status).toBe(201);
    const tok = await M.QrToken.findOne({ where: { user_id: peserta.id } });
    expect(tok.lat).toBe(DI_DALAM.lat);
    expect(tok.akurasi_m).toBe(DI_DALAM.akurasi_m);

    const scan = await request(app).post('/api/absensi/scan')
      .set('Authorization', await tokenUntuk(pembimbing.email)).send({ token: ok.body.token });
    expect(scan.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.lat).toBe(DI_DALAM.lat);
    expect(baris.di_dalam_area).toBe(true);
    expect(baris.jarak_m).toBeLessThanOrEqual(KANTOR.radius_m);
  });

  test('token lama (tayang sebelum kantor diatur) tanpa lokasi -> scan ditolak LOKASI_DIBUTUHKAN', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await hariKerja();
    const authzAdm = await tokenUntuk(admin.email);
    await setMode(authzAdm, 'qr');
    waktu.__jam('08:00');
    const ok = await tayang(peserta); // kantor belum diatur: QR tayang tanpa lokasi
    expect(ok.status).toBe(201);
    await setKantor(authzAdm); // kantor diatur setelah QR tayang
    const scan = await request(app).post('/api/absensi/scan')
      .set('Authorization', await tokenUntuk(pembimbing.email)).send({ token: ok.body.token });
    expect(scan.status).toBe(422);
    expect(scan.body).toMatchObject({ kode: 'LOKASI_DIBUTUHKAN' });
    expect(await M.Absensi.count()).toBe(0);
  });

  test('kantor belum diatur: qr-saya tanpa lokasi dan scan tetap jalan seperti sebelumnya', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await hariKerja();
    await setMode(await tokenUntuk(admin.email), 'qr');
    waktu.__jam('08:00');
    const ok = await tayang(peserta);
    expect(ok.status).toBe(201);
    const tok = await M.QrToken.findOne({ where: { user_id: peserta.id } });
    expect(tok.lat).toBeNull();
    const scan = await request(app).post('/api/absensi/scan')
      .set('Authorization', await tokenUntuk(pembimbing.email)).send({ token: ok.body.token });
    expect(scan.status).toBe(200);
    const baris = await M.Absensi.findOne({ where: { user_id: peserta.id } });
    expect(baris.lat).toBeNull();
  });

  test('radius kantor dikecilkan setelah QR tayang: scan memakai radius terkini', async () => {
    const { admin, peserta, pembimbing } = await isiDasar();
    await hariKerja();
    const authzAdm = await tokenUntuk(admin.email);
    await setMode(authzAdm, 'qr');
    await setKantor(authzAdm, { ...KANTOR, radius_m: 5000 });
    waktu.__jam('08:00');
    const ok = await tayang(peserta, { lat: -6.205, lng: 106.816, akurasi_m: 20 }); // ±556 m
    expect(ok.status).toBe(201);
    await setKantor(authzAdm, { ...KANTOR, radius_m: 150 }); // dipersempit
    const scan = await request(app).post('/api/absensi/scan')
      .set('Authorization', await tokenUntuk(pembimbing.email)).send({ token: ok.body.token });
    expect(scan.status).toBe(422);
    expect(scan.body).toMatchObject({ kode: 'DI_LUAR_RADIUS' });
  });
});

/* ---------- API: riwayat peserta memuat lokasi ---------- */
describe('riwayat (/absensi/riwayat) menyertakan kolom lokasi', () => {
  test('atribut lat/lng/jarak_m/di_dalam_area ada di respons', async () => {
    const { admin, peserta } = await isiDasar();
    await hariKerja();
    const authzAdm = await tokenUntuk(admin.email);
    await setMode(authzAdm, 'wajah');
    await setKantor(authzAdm);
    waktu.__jam('08:00');
    const authz = await tokenUntuk(peserta.email);
    await request(app).post('/api/face/enroll').set('Authorization', authz).send({ embedding: VEK(), persetujuan: true });
    const tan = await request(app).post('/api/face/tantangan').set('Authorization', authz);
    await request(app).post('/api/absensi/wajah').set('Authorization', authz)
      .send({ jenis: 'masuk', embedding: VEK(), nonce: tan.body.nonce, ...DI_DALAM });

    const r = await request(app).get('/api/absensi/riwayat').set('Authorization', authz);
    expect(r.status).toBe(200);
    expect(r.body.data[0]).toMatchObject({
      lat: DI_DALAM.lat, lng: DI_DALAM.lng, di_dalam_area: true,
    });
    expect(r.body.data[0]).toHaveProperty('jarak_m');
  });
});
