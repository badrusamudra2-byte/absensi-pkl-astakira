const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk } = require('./helper');
const { bagian } = require('../src/utils/waktu');
const path = require('path');
const fs = require('fs');

beforeEach(kosongkanDb);

const HARI = bagian().tanggal;

// Byte kepala JPEG sah (magic bytes yang diperiksa middleware)
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const TXT = Buffer.from('bukan gambar');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

const DIR = path.join(__dirname, '../uploads/lampiran');
const adaBerkas = (nama) => fs.existsSync(path.join(DIR, nama));

/** Buat jurnal draft milik peserta lewat API. */
const jurnal = async (authz, tanggal = HARI) => {
  await M.Absensi.create({ user_id: dasar.peserta.id, tanggal, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah' });
  return (await request(app).post('/api/jurnal').set('Authorization', authz)
    .send({ judul: 'Kegiatan hari itu', uraian: 'Rincian kegiatan.', tanggal })).body;
};

let dasar, tokPsr, tokPmb;

beforeEach(async () => {
  dasar = await isiDasar();
  tokPsr = await tokenUntuk(dasar.peserta.email);
  tokPmb = await tokenUntuk(dasar.pembimbing.email);
});

describe('lampiran foto kegiatan jurnal (opsional)', () => {
  test('unggah lampiran: berkas tersimpan, detail memuat nama lampiran', async () => {
    const j = await jurnal(tokPsr);
    const r = await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', JPG, { filename: 'hasil.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(200);
    expect(r.body.lampiran).toMatch(/\.jpg$/);
    expect(adaBerkas(r.body.lampiran)).toBe(true);

    const detail = await request(app).get(`/api/jurnal/${j.id}`).set('Authorization', tokPsr);
    expect(detail.body.lampiran).toBe(r.body.lampiran);
  });

  test('tanpa lampiran tetap sah — fitur memang opsional', async () => {
    const j = await jurnal(tokPsr);
    const detail = await request(app).get(`/api/jurnal/${j.id}`).set('Authorization', tokPsr);
    expect(detail.body.lampiran).toBeNull();
  });

  test('ganti lampiran menghapus berkas lama; hapus lampiran mengosongkan', async () => {
    const j = await jurnal(tokPsr);
    const a = await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', JPG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    const lama = a.body.lampiran;
    const b = await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(b.status).toBe(200);
    expect(b.body.lampiran.endsWith('.png')).toBe(true);
    expect(adaBerkas(lama)).toBe(false);

    const hapus = await request(app).delete(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr);
    expect(hapus.status).toBe(200);
    expect(hapus.body.lampiran).toBeNull();
    expect(adaBerkas(b.body.lampiran)).toBe(false);
  });

  test('lihat lampiran: pemilik, pembimbing bimbingan, dan admin boleh; peserta lain ditolak', async () => {
    const j = await jurnal(tokPsr);
    await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', JPG, { filename: 'x.jpg', contentType: 'image/jpeg' });

    const pemilik = await request(app).get(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr);
    expect(pemilik.status).toBe(200);
    expect(pemilik.headers['content-type']).toMatch(/image\/jpeg/);

    const pmb = await request(app).get(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPmb);
    expect(pmb.status).toBe(200);

    const adm = await request(app).get(`/api/jurnal/${j.id}/lampiran`).set('Authorization', await tokenUntuk(dasar.admin.email));
    expect(adm.status).toBe(200);

    const lain = await buatUser({ nama: 'Farhan', username: 'farhan', email: 'farhan@astakira.id', role: 'peserta' });
    const rLain = await request(app).get(`/api/jurnal/${j.id}/lampiran`)
      .set('Authorization', await tokenUntuk(lain.email));
    expect(rLain.status).toBe(403);
    expect(rLain.body).toMatchObject({ kode: 'DILARANG' });
  });

  test('jurnal Dikirim/Disetujui tidak bisa diganti lampiran -> 409 STATUS_TIDAK_VALID', async () => {
    const j = await jurnal(tokPsr);
    await M.Jurnal.update({ status: 'Disetujui' }, { where: { id: j.id } });
    const r = await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', JPG, { filename: 'y.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ kode: 'STATUS_TIDAK_VALID' });
  });

  test('bukan gambar ditolak 422 UPLOAD dan tidak menyisakan berkas', async () => {
    const j = await jurnal(tokPsr);
    const r = await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', TXT, { filename: 'bukan.txt', contentType: 'text/plain' });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ kode: 'UPLOAD' });
    const sisa = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt'));
    expect(sisa).toHaveLength(0);
  });

  test('lampiran diunggah dua kali tanpa berkas (PUT kosong) berarti hapus', async () => {
    const j = await jurnal(tokPsr);
    await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', JPG, { filename: 'z.jpg', contentType: 'image/jpeg' });
    const r = await request(app).put(`/api/jurnal/${j.id}/lampiran`).set('Authorization', tokPsr);
    expect(r.status).toBe(200);
    expect(r.body.lampiran).toBeNull();
  });

  test('jurnal milik orang lain -> 404', async () => {
    const lain = await buatUser({ nama: 'Farhan', username: 'farhan', email: 'farhan@astakira.id', role: 'peserta' });
    await M.Absensi.create({ user_id: lain.id, tanggal: HARI, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah' });
    const tokLain = await tokenUntuk(lain.email);
    const jLain = (await request(app).post('/api/jurnal').set('Authorization', tokLain)
      .send({ judul: 'Milik Farhan', uraian: 'Kegiatan Farhan.', tanggal: HARI })).body;

    const r = await request(app).put(`/api/jurnal/${jLain.id}/lampiran`).set('Authorization', tokPsr)
      .attach('lampiran', JPG, { filename: 'curi.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(404);
  });
});
