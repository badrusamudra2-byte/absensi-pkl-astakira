const request = require('supertest');
const app = require('../src/app');
const { kosongkanDb, isiDasar, tokenUntuk } = require('./helper');
const M = require('../src/models');

const TGL_LAMPAU = new Date(Date.parse(`${require('../src/utils/waktu').bagian().tanggal}T00:00:00Z`) - 86400000)
  .toISOString().slice(0, 10);

let dasar, tokAdmin, tokPmb, absen;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();
  tokAdmin = await tokenUntuk('admin@astakira.id');
  tokPmb = await tokenUntuk('rizal@astakira.id');
  absen = await M.Absensi.create({
    user_id: dasar.peserta.id, tanggal: TGL_LAMPAU, jenis: 'masuk', jam: '09:30:00',
    status: 'Terlambat', metode: 'QR+Wajah',
  });
});

const koreksi = (token, id, isi) =>
  request(app).put(`/api/admin/absensi/${id}`).set('Authorization', token).send(isi);

describe('Koreksi absensi oleh admin', () => {
  test('koreksi jam dan status berhasil, nilai lama dan baru tersimpan di audit log', async () => {
    const r = await koreksi(tokAdmin, absen.id, { jam: '07:55:00', status: 'Hadir', alasan: 'Peserta tercatat salah oleh pemindai.' });
    expect(r.status).toBe(200);
    const a = await M.Absensi.findByPk(absen.id);
    expect(a.jam).toBe('07:55:00');
    expect(a.status).toBe('Hadir');

    const log = await M.AuditLog.findOne({ where: { aksi: 'Koreksi absensi' } });
    expect(log).toBeTruthy();
    const detail = JSON.parse(log.detail);
    expect(detail.alasan).toBe('Peserta tercatat salah oleh pemindai.');
    expect(detail.lama).toMatchObject({ jam: '09:30:00', status: 'Terlambat' });
    expect(detail.baru).toMatchObject({ jam: '07:55:00', status: 'Hadir' });
  });

  test('koreksi ke status Tidak hadir diizinkan', async () => {
    const r = await koreksi(tokAdmin, absen.id, { status: 'Tidak hadir', alasan: 'Ternyata tidak datang sama sekali.' });
    expect(r.status).toBe(200);
    expect((await M.Absensi.findByPk(absen.id)).status).toBe('Tidak hadir');
  });

  test('alasan wajib (minimal 3 karakter)', async () => {
    const tanpa = await koreksi(tokAdmin, absen.id, { jam: '08:00:00' });
    expect(tanpa.status).toBe(400);
    expect(tanpa.body.kode).toBe('ALASAN_WAJIB');
    const pendek = await koreksi(tokAdmin, absen.id, { jam: '08:00:00', alasan: 'ok' });
    expect(pendek.status).toBe(400);
    expect(pendek.body.kode).toBe('ALASAN_WAJIB');
  });

  test('status atau jenis tidak valid ditolak', async () => {
    const st = await koreksi(tokAdmin, absen.id, { status: 'Izin libur', alasan: 'Coba status ngawur.' });
    expect(st.status).toBe(400);
    const jn = await koreksi(tokAdmin, absen.id, { jenis: 'istirahat', alasan: 'Coba jenis ngawur.' });
    expect(jn.status).toBe(400);
    const jam = await koreksi(tokAdmin, absen.id, { jam: '25:99', alasan: 'Jam ngawur.' });
    expect(jam.status).toBe(400);
  });

  test('tanpa perubahan dikirim ditolak', async () => {
    const r = await koreksi(tokAdmin, absen.id, { alasan: 'Tidak ada kolom yang diubah.' });
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('VALIDASI');
  });

  test('jenis tidak bisa diubah (satu baris per hari); data pulang bisa dikoreksi', async () => {
    const jn = await koreksi(tokAdmin, absen.id, { jenis: 'pulang', alasan: 'Mencoba ubah jenis.' });
    expect(jn.status).toBe(400);
    expect(jn.body.kode).toBe('VALIDASI');

    // Koreksi data pulang pada baris masuk yang sama
    const r = await koreksi(tokAdmin, absen.id, { pulang_jam: '17:05:00', alasan: 'Lupa absen pulang, disetel manual.' });
    expect(r.status).toBe(200);
    const a = await M.Absensi.findByPk(absen.id);
    expect(a.pulang_jam).toBe('17:05:00');
    expect(a.pulang_status).toBe('Hadir');
    // Data masuk tidak tersentuh
    expect(a.jam).toBe('09:30:00');
    expect(a.status).toBe('Terlambat');

    // pulang_jam bisa dikosongkan (null)
    const kosong = await koreksi(tokAdmin, absen.id, { pulang_jam: null, alasan: 'Ternyata tidak perlu data pulang.' });
    expect(kosong.status).toBe(200);
    const b = await M.Absensi.findByPk(absen.id);
    expect(b.pulang_jam).toBeNull();
    expect(b.pulang_status).toBeNull();
  });

  test('id absensi yang tidak ada -> 404', async () => {
    const r = await koreksi(tokAdmin, 99999, { jam: '08:00:00', alasan: 'Baris fiktif.' });
    expect(r.status).toBe(404);
  });

  test('pembimbing dan peserta tidak boleh mengoreksi', async () => {
    const pmb = await koreksi(tokPmb, absen.id, { jam: '08:00:00', alasan: 'Pembimbing mencoba koreksi.' });
    expect(pmb.status).toBe(403);
    const psr = await request(app).put(`/api/admin/absensi/${absen.id}`).set('Authorization', 'Bearer x').send({});
    expect([401, 403]).toContain(psr.status);
  });

  test('daftar absensi per tanggal untuk form koreksi', async () => {
    const r = await request(app)
      .get(`/api/admin/absensi?user_id=${dasar.peserta.id}&tanggal=${TGL_LAMPAU}`)
      .set('Authorization', tokAdmin);
    expect(r.status).toBe(200);
    expect(r.body.peserta.nama).toBe('Alya Rahma');
    // Satu baris per hari: hanya baris masuk
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].jenis).toBe('masuk');

    const salah = await request(app)
      .get(`/api/admin/absensi?user_id=${dasar.peserta.id}&tanggal=17-10-2026`)
      .set('Authorization', tokAdmin);
    expect(salah.status).toBe(400);
  });
});
