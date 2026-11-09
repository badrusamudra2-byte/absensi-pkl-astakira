const request = require('supertest');
const app = require('../src/app');
const { bagian } = require('../src/utils/waktu');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk, SANDI_SEED } = require('./helper');
const { enc } = require('../src/utils/crypto');
const M = require('../src/models');

const TGL_KINI = bagian().tanggal;
const TGL_LAMPAU = new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const TGL_DEPAN = new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const TGL_LAMBUAT = new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) - 8 * 86400000).toISOString().slice(0, 10);

let dasar, tokPmb, tokAdmin, tokPeserta, tokPmbLain, pesertaLain;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();

  const pmbLain = await buatUser({ nama: 'Sinta Lestari', username: 'sinta', email: 'sinta@astakira.id', role: 'pembimbing' });
  await M.Pembimbing.create({ user_id: pmbLain.id, divisi: 'Web' });
  pesertaLain = await buatUser({ nama: 'Budi Setia', username: 'budi', email: 'budi@astakira.id', role: 'peserta' });
  await M.Peserta.create({ user_id: pesertaLain.id, divisi: 'Web', pembimbing_id: pmbLain.id });

  // Buat hari ini hari kerja agar uji blokir QR relevan
  await M.Workshift.update(
    { hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00' },
    { where: { hari: bagian().hari } },
  );

  tokPmb = await tokenUntuk('rizal@astakira.id');
  tokAdmin = await tokenUntuk('admin@astakira.id');
  tokPeserta = await tokenUntuk('alya@astakira.id');
  tokPmbLain = await tokenUntuk('sinta@astakira.id');
});

const catat = (token, isi) =>
  request(app)
    .post('/api/pembimbing/keterangan')
    .set('Authorization', token)
    .send(isi);

describe('Catat Izin/Sakit (pembimbing & admin)', () => {
  test('pembimbing mencatat izin untuk bimbingannya', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'Menghadiri acara keluarga.',
    });
    expect(r.status).toBe(201);
    const b = await M.Absensi.findOne({ where: { user_id: dasar.peserta.id, tanggal: TGL_KINI } });
    expect(b.status).toBe('Izin');
    expect(b.metode).toBe('Izin');
    expect(b.jenis).toBe('masuk');
    expect(b.keterangan).toBe('Menghadiri acara keluarga.');
    expect(b.dikonfirmasi_oleh).toBe(dasar.pembimbing.id);
  });

  test('pembimbing mencatat sakit', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Sakit', keterangan: 'Demam, surat dokter menyusul.',
    });
    expect(r.status).toBe(201);
    const b = await M.Absensi.findOne({ where: { user_id: dasar.peserta.id, tanggal: TGL_KINI } });
    expect(b.status).toBe('Sakit');
    expect(b.metode).toBe('Sakit');
  });

  test('admin dapat mencatat izin untuk peserta mana saja', async () => {
    const r = await request(app)
      .post('/api/admin/absensi/keterangan')
      .set('Authorization', tokAdmin)
      .send({ user_id: pesertaLain.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'Izin kerja bakti sekolah.' });
    expect(r.status).toBe(201);
  });

  test('pembimbing tidak dapat mencatat untuk peserta bukan bimbingannya', async () => {
    const r = await catat(tokPmbLain, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'Bukan bimbingan saya.',
    });
    expect(r.status).toBe(403);
    expect(r.body.kode).toBe('BUKAN_BIMBINGAN');
  });

  test('peserta tidak boleh memanggil endpoint keterangan pembimbing', async () => {
    const r = await request(app)
      .post('/api/pembimbing/keterangan')
      .set('Authorization', tokPeserta)
      .send({ user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'Peserta mencoba mencatat sendiri.' });
    expect(r.status).toBe(403);
  });

  test('keterangan terlalu pendek ditolak', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'ok',
    });
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('VALIDASI');
  });

  test('status selain Izin/Sakit ditolak', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Hadir', keterangan: 'Mencoba memanipulasi status.',
    });
    expect(r.status).toBe(400);
  });

  test('tanggal masa depan ditolak', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_DEPAN, status: 'Izin', keterangan: 'Mengajukan izin duluan.',
    });
    expect(r.status).toBe(400);
  });

  test('tanggal lebih dari 7 hari ke belakang ditolak', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_LAMBUAT, status: 'Izin', keterangan: 'Izin kembali aplikasi hari kemarin.',
    });
    expect(r.status).toBe(400);
  });

  test('format tanggal salah ditolak', async () => {
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: '15-10-2026', status: 'Izin', keterangan: 'Format beda.',
    });
    expect(r.status).toBe(400);
  });

  test('izin dua kali untuk tanggal sama ditolak (CATATAN_ADA)', async () => {
    await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, status: 'Izin', keterangan: 'Izin pertama sah.',
    });
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, status: 'Sakit', keterangan: 'Mengubah jadi sakit.',
    });
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('CATATAN_ADA');
  });

  test('izin tidak bisa dicatat bila hari itu sudah ada absensi', async () => {
    await M.Absensi.create({
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah',
    });
    const r = await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, status: 'Izin', keterangan: 'Mengubah absensi jadi izin.',
    });
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('CATATAN_ADA');
  });

  test('setelah izin, pindaian QR absen masuk dan pulang ditolak (HARI_TERCATAT)', async () => {
    await M.PengaturanAbsensi.findOrCreate({ where: { id: 1 }, defaults: { metode: 'qr' } });
    require('../src/services/pengaturan').segarkan();
    await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'Menghadiri undangan pernikahan.',
    });
    const tayang = await request(app)
      .post('/api/absensi/qr-tayang')
      .set('Authorization', tokPmb);
    expect(tayang.status).toBe(201);

    const masuk = await request(app)
      .post('/api/absensi/konfirmasi-scan')
      .set('Authorization', tokPeserta)
      .send({ token: tayang.body.token, jenis: 'masuk' });
    expect(masuk.status).toBe(409);
    expect(masuk.body.kode).toBe('HARI_TERCATAT');

    const pulang = await request(app)
      .post('/api/absensi/konfirmasi-scan')
      .set('Authorization', tokPeserta)
      .send({ token: tayang.body.token, jenis: 'pulang' });
    expect(pulang.status).toBe(409);
    expect(pulang.body.kode).toBe('HARI_TERCATAT');
  });

  test('setelah izin, absensi wajah langsung juga ditolak', async () => {
    await M.PengaturanAbsensi.findOrCreate({ where: { id: 1 }, defaults: { metode: 'wajah' } });
    require('../src/services/pengaturan').segarkan();
    // Template tetap dibuat agar alur sampai ke cek terkunci (terletak setelah cek template)
    const vek = Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 0.1 : -0.1));
    await M.FaceTemplate.create({ user_id: dasar.peserta.id, embedding: enc(vek) });
    await catat(tokPmb, {
      user_id: dasar.peserta.id, tanggal: TGL_KINI, status: 'Izin', keterangan: 'Cuti kejadian khusus.',
    });
    const r = await request(app)
      .post('/api/absensi/wajah')
      .set('Authorization', tokPeserta)
      .send({ embedding: vek, jenis: 'masuk' });
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('HARI_TERCATAT');
  });
});
