const request = require('supertest');
const app = require('../src/app');
const { bagian } = require('../src/utils/waktu');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk } = require('./helper');
const { enc } = require('../src/utils/crypto');
const M = require('../src/models');

const TGL_KINI = bagian().tanggal;
const TGL_LAMPAU = new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const TGL_DEPAN = new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const TGL_LAMBUAT = new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) - 8 * 86400000).toISOString().slice(0, 10);

// Byte kepala JPEG dan PNG sah (magic bytes yang diperiksa middleware)
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let dasar, tokPmb, tokPeserta, tokPmbLain;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();

  const pmbLain = await buatUser({ nama: 'Sinta Lestari', username: 'sinta', email: 'sinta@astakira.id', role: 'pembimbing' });
  await M.Pembimbing.create({ user_id: pmbLain.id, divisi: 'Web' });

  // Buat hari ini hari kerja agar uji blokir QR relevan
  await M.Workshift.update(
    { hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00' },
    { where: { hari: bagian().hari } },
  );

  tokPmb = await tokenUntuk('rizal@astakira.id');
  tokPeserta = await tokenUntuk('alya@astakira.id');
  tokPmbLain = await tokenUntuk('sinta@astakira.id');
});

const kirim = (token, fields, attach = true) => {
  const r = request(app).post('/api/pengajuan/izin').set('Authorization', token);
  if (attach) r.attach('bukti', JPG, { filename: 'bukti.jpg', contentType: 'image/jpeg' });
  for (const [k, v] of Object.entries(fields)) r.field(k, v);
  return r;
};

describe('Kirim pengajuan izin/sakit (peserta)', () => {
  test('peserta mengajukan izin hari ini + bukti foto: 201 Menunggu', async () => {
    const r = await kirim(tokPeserta, {
      jenis: 'Izin', tanggal: TGL_KINI, keterangan: 'Menghadiri acara keluarga.',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('Menunggu');
    const p = await M.PengajuanIzin.findOne({ where: { user_id: dasar.peserta.id } });
    expect(p.jenis).toBe('Izin');
    expect(p.keterangan).toBe('Menghadiri acara keluarga.');
  });

  test('tanpa lampiran bukti ditolak (BUKTI_WAJIB)', async () => {
    const r = await kirim(tokPeserta, { jenis: 'Izin', tanggal: TGL_KINI, keterangan: 'Tanpa bukti apa pun.' }, false);
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('BUKTI_WAJIB');
  });

  test('bukti bukan gambar ditolak (UPLOAD)', async () => {
    const r = await request(app)
      .post('/api/pengajuan/izin')
      .set('Authorization', tokPeserta)
      .attach('bukti', Buffer.from('ini bukan gambar'), { filename: 'bukti.txt', contentType: 'text/plain' })
      .field('jenis', 'Izin')
      .field('tanggal', TGL_KINI)
      .field('keterangan', 'Melampirkan dokumen teks semata.');
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('UPLOAD');
  });

  test('jenis selain Izin/Sakit ditolak', async () => {
    const r = await kirim(tokPeserta, { jenis: 'Hadir', tanggal: TGL_KINI, keterangan: 'Mencoba memanipulasi status.' });
    expect(r.status).toBe(400);
  });

  test('keterangan terlalu pendek ditolak', async () => {
    const r = await kirim(tokPeserta, { jenis: 'Izin', tanggal: TGL_KINI, keterangan: 'ok' });
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('VALIDASI');
  });

  test('tanggal masa depan ditolak', async () => {
    const r = await kirim(tokPeserta, { jenis: 'Izin', tanggal: TGL_DEPAN, keterangan: 'Mengajukan izin duluan.' });
    expect(r.status).toBe(400);
  });

  test('tanggal lebih dari 7 hari ke belakang ditolak', async () => {
    const r = await kirim(tokPeserta, { jenis: 'Sakit', tanggal: TGL_LAMBUAT, keterangan: 'Lupa mengajukan sakit lusa.' });
    expect(r.status).toBe(400);
  });

  test('format tanggal salah ditolak', async () => {
    const r = await kirim(tokPeserta, { jenis: 'Izin', tanggal: '15-10-2026', keterangan: 'Format beda sekali.' });
    expect(r.status).toBe(400);
  });

  test('pengajuan ganda untuk tanggal sama ditolak (CATATAN_ADA)', async () => {
    await kirim(tokPeserta, { jenis: 'Izin', tanggal: TGL_LAMPAU, keterangan: 'Pengajuan pertama sah.' });
    const r = await kirim(tokPeserta, { jenis: 'Sakit', tanggal: TGL_LAMPAU, keterangan: 'Mengubah jadi sakit dong.' });
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('CATATAN_ADA');
  });

  test('pengajuan ditolak bila hari itu sudah ada absensi (CATATAN_ADA)', async () => {
    await M.Absensi.create({
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah',
    });
    const r = await kirim(tokPeserta, { jenis: 'Izin', tanggal: TGL_LAMPAU, keterangan: 'Mengubah absensi jadi izin.' });
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('CATATAN_ADA');
  });

  test('pembimbing tidak boleh mengirim pengajuan', async () => {
    const r = await kirim(tokPmb, { jenis: 'Izin', tanggal: TGL_KINI, keterangan: 'Pembimbing mencoba mengajukan.' });
    expect(r.status).toBe(403);
  });
});

describe('Daftar & notifikasi pengajuan', () => {
  test('peserta hanya melihat pengajuannya sendiri', async () => {
    const lain = await buatUser({ nama: 'Budi Setia', username: 'budi', email: 'budi@astakira.id', role: 'peserta' });
    await M.Peserta.create({ user_id: lain.id, divisi: 'Web', pembimbing_id: dasar.pembimbing.id });
    await M.PengajuanIzin.create({
      user_id: lain.id, tanggal: TGL_LAMPAU, jenis: 'Izin', keterangan: 'Izin milik Budi saja.', bukti: 'a.jpg',
    });
    const r = await request(app).get('/api/pengajuan/izin').set('Authorization', tokPeserta);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(0);
  });

  test('pembimbing melihat pengajuan bimbingannya', async () => {
    await M.PengajuanIzin.create({
      user_id: dasar.peserta.id, tanggal: TGL_KINI, jenis: 'Sakit', keterangan: 'Demam sejak subuh tadi.', bukti: 'b.jpg',
    });
    const r = await request(app).get('/api/pengajuan/izin').set('Authorization', tokPmb);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].peserta.nama).toBe(dasar.peserta.nama);
  });

  test('notifikasi ada=true saat ada pengajuan Menunggu hari ini', async () => {
    await M.PengajuanIzin.create({
      user_id: dasar.peserta.id, tanggal: TGL_KINI, jenis: 'Izin', keterangan: 'Izin hari ini menunggu.', bukti: 'c.jpg',
    });
    const r = await request(app).get('/api/pengajuan/notifikasi').set('Authorization', tokPmb);
    expect(r.status).toBe(200);
    expect(r.body.ada).toBe(true);
  });

  test('notifikasi ada=false tanpa pengajuan', async () => {
    const r = await request(app).get('/api/pengajuan/notifikasi').set('Authorization', tokPmb);
    expect(r.body.ada).toBe(false);
  });

  test('notifikasi hanya peduli tanggal hari ini', async () => {
    await M.PengajuanIzin.create({
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, jenis: 'Izin', keterangan: 'Izin kemarin belum ditangani.', bukti: 'd.jpg',
    });
    const r = await request(app).get('/api/pengajuan/notifikasi').set('Authorization', tokPmb);
    expect(r.body.ada).toBe(false);
  });
});

describe('Putusan pembimbing', () => {
  let idPengajuan, idSakit;

  beforeEach(async () => {
    idPengajuan = (await M.PengajuanIzin.create({
      user_id: dasar.peserta.id, tanggal: TGL_KINI, jenis: 'Izin', keterangan: 'Menghadiri undangan keluarga.', bukti: 'e.jpg',
    })).id;
    idSakit = (await M.PengajuanIzin.create({
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, jenis: 'Sakit', keterangan: 'Demam, surat dokter menyusul.', bukti: 'f.jpg',
    })).id;
  });

  test('Disetujui: baris absensi Izin dibuat, hari terkunci dari QR', async () => {
    const r = await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Disetujui' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('Disetujui');

    const b = await M.Absensi.findOne({ where: { user_id: dasar.peserta.id, tanggal: TGL_KINI } });
    expect(b).not.toBeNull();
    expect(b.status).toBe('Izin');
    expect(b.metode).toBe('Izin');
    expect(b.jenis).toBe('masuk');
    expect(b.keterangan).toBe('Menghadiri undangan keluarga.');
    expect(b.dikonfirmasi_oleh).toBe(dasar.pembimbing.id);

    // QR jenis sama tetap bisa diminta (Izin dikecualikan dari SUDAH_ABSEN),
    // tapi pindaiannya ditolak karena hari terkunci
    await M.PengaturanAbsensi.findOrCreate({ where: { id: 1 }, defaults: { metode: 'qr' } });
    require('../src/services/pengaturan').segarkan();
    const minta = await request(app)
      .post('/api/absensi/qr-saya')
      .set('Authorization', tokPeserta)
      .send({ jenis: 'masuk' });
    expect(minta.status).toBe(201);
    const masuk = await request(app)
      .post('/api/absensi/scan')
      .set('Authorization', tokPmb)
      .send({ token: minta.body.token });
    expect(masuk.status).toBe(409);
    expect(masuk.body.kode).toBe('HARI_TERCATAT');
  });

  test('Disetujui Sakit: baris absensi Sakit dibuat dengan metode Sakit', async () => {
    const r = await request(app)
      .put(`/api/pengajuan/izin/${idSakit}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Disetujui' });
    expect(r.status).toBe(200);
    const b = await M.Absensi.findOne({ where: { user_id: dasar.peserta.id, tanggal: TGL_LAMPAU } });
    expect(b.status).toBe('Sakit');
    expect(b.metode).toBe('Sakit');
  });

  test('setelah Disetujui, pengajuan baru tanggal sama ditolak (CATATAN_ADA)', async () => {
    await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Disetujui' });
    const r = await kirim(tokPeserta, { jenis: 'Sakit', tanggal: TGL_KINI, keterangan: 'Mengganti izin jadi sakit.' });
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('CATATAN_ADA');
  });

  test('Ditolak: tak ada baris absensi; alasan wajib dan tersimpan', async () => {
    const tanpa = await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Ditolak' });
    expect(tanpa.status).toBe(400);

    const r = await request(app)
      .put(`/api/pengajuan/izin/${idSakit}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Ditolak', alasan: 'Bukti foto tidak jelas.' });
    expect(r.status).toBe(200);
    const p = await M.PengajuanIzin.findByPk(idSakit);
    expect(p.status).toBe('Ditolak');
    expect(p.catatan_putusan).toBe('Bukti foto tidak jelas.');
    expect(p.ditangani_oleh).toBe(dasar.pembimbing.id);
    expect(await M.Absensi.count({ where: { user_id: dasar.peserta.id, tanggal: TGL_LAMPAU } })).toBe(0);
  });

  test('pengajuan Ditolak bisa diajukan ulang tanggal sama', async () => {
    await request(app)
      .put(`/api/pengajuan/izin/${idSakit}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Ditolak', alasan: 'Bukti foto tidak jelas.' });
    const r = await kirim(tokPeserta, { jenis: 'Sakit', tanggal: TGL_LAMPAU, keterangan: 'Melampirkan surat baru sah.' });
    expect(r.status).toBe(201);
  });

  test('pembimbing bukan bimbangan ditolak (BUKAN_BIMBINGAN)', async () => {
    const r = await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmbLain)
      .send({ putusan: 'Disetujui' });
    expect(r.status).toBe(403);
    expect(r.body.kode).toBe('BUKAN_BIMBINGAN');
  });

  test('peserta tidak boleh memutuskan', async () => {
    const r = await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPeserta)
      .send({ putusan: 'Disetujui' });
    expect(r.status).toBe(403);
  });

  test('putusan selain Disetujui/Ditolak ditolak', async () => {
    const r = await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Hadir' });
    expect(r.status).toBe(400);
  });

  test('pengajuan yang sudah diputuskan tak bisa diputuskan lagi', async () => {
    await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Ditolak', alasan: 'Bukti foto tidak jelas.' });
    const r = await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Disetujui' });
    expect(r.status).toBe(404);
    expect(r.body.kode).toBe('TIDAK_ADA');
  });

  test('notifikasi jadi false setelah semua diputuskan', async () => {
    // `idPengajuan` juga hari ini: putuskan dulu agar hanya sisa `hariIni` menunggu
    await request(app)
      .put(`/api/pengajuan/izin/${idPengajuan}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Disetujui' });
    const hariIni = await M.PengajuanIzin.create({
      user_id: dasar.peserta.id, tanggal: TGL_KINI, jenis: 'Izin', keterangan: 'Tidak jadi, batal saja sekali.', bukti: 'g.jpg',
    });
    await request(app)
      .put(`/api/pengajuan/izin/${hariIni.id}/putuskan`)
      .set('Authorization', tokPmb)
      .send({ putusan: 'Ditolak', alasan: 'Bukti foto tidak jelas.' });
    const r = await request(app).get('/api/pengajuan/notifikasi').set('Authorization', tokPmb);
    expect(r.body.ada).toBe(false);
  });
});
