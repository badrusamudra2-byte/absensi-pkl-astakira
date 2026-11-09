const request = require('supertest');
const app = require('../src/app');
const M = require('../src/models');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk } = require('./helper');
const { bagian } = require('../src/utils/waktu');

beforeEach(kosongkanDb);

const HARI = bagian().tanggal; // "2026-10-17"
const hariLalu = (n) => new Date(new Date(`${HARI}T00:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);
const hariDepan = (n) => new Date(new Date(`${HARI}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

const ISI = () => ({ judul: 'Membuat wireframe', uraian: 'Membuat wireframe 5 halaman utama.', hasil: 'Diterima mentor', kendala: 'Belum ada', rencana: 'Lanjut alur absensi' });

/* ---------- Perulangan: status siklus valid ---------- */
describe('siklus status jurnal', () => {
  test('buat draft -> kirim -> Dikirim', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);

    const buat = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), tanggal: HARI });
    expect(buat.status).toBe(201);
    expect(buat.body.status).toBe('Draft');

    const kirim = await request(app).put(`/api/jurnal/${buat.body.id}`).set('Authorization', authz)
      .send({ ...ISI(), tanggal: HARI, aksi: 'kirim' });
    expect(kirim.status).toBe(200);
    expect(kirim.body.status).toBe('Dikirim');
  });

  test('langsung kirim saat create (aksi=kirim) -> Dikirim', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authz)
      .send({ ...ISI(), tanggal: HARI, aksi: 'kirim' });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('Dikirim');
  });

  test('jurnal Revisi: perbaiki dan kirim ulang -> Dikirim; riwayat review ikut di detail', async () => {
    const { peserta, pembimbing } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);

    const id = (await (await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), tanggal: HARI, aksi: 'kirim' })).body).id;

    // Pembimbing minta revisi (proses dibantu langsung lewat model; review endpoint fase-1 sudah ada tapi tidak diuji di sini)
    await M.JurnalReview.create({ jurnal_id: id, pembimbing_id: pembimbing.id, keputusan: 'Revisi', catatan: 'Tambah media' });
    const j = await M.Jurnal.findByPk(id);
    await j.update({ status: 'Revisi' });

    const ulang = await request(app).put(`/api/jurnal/${id}`).set('Authorization', authz)
      .send({ ...ISI(), uraian: 'Membuat wireframe + tumpukan warna.', tanggal: HARI, aksi: 'kirim' });
    expect(ulang.status).toBe(200);
    expect(ulang.body.status).toBe('Dikirim');

    const detail = await request(app).get(`/api/jurnal/${id}`).set('Authorization', authz);
    const reviews = detail.body.reviews ?? [];
    const catatan = reviews.find((r) => r.catatan === 'Tambah media');
    expect(reviews.length).toBeGreaterThanOrEqual(1);
    expect(catatan.pembimbing).toMatchObject({ id: pembimbing.id, nama: pembimbing.nama });
  });

  test('jurnal Disetujui tidak boleh diubah; hasil edit Draft/Revisi hanya Draft atau Revisi yang lolos', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), tanggal: HARI });
    const id = r.body.id;
    await M.Jurnal.update({ status: 'Disetujui' }, { where: { id } });

    const kirim = await request(app).put(`/api/jurnal/${id}`).set('Authorization', authz)
      .send({ ...ISI(), tanggal: HARI, aksi: 'kirim' });
    expect(kirim.status).toBe(409);
    expect(kirim.body).toMatchObject({ kode: 'STATUS_TIDAK_VALID' });

    const edit = await request(app).put(`/api/jurnal/${id}`).set('Authorization', authz).send({ ...ISI(), tanggal: HARI });
    expect(edit.status).toBe(409);
  });

  test('jurnal Dikirim tidak boleh diubah -> 409 STATUS_TIDAK_VALID', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authz)
      .send({ ...ISI(), tanggal: HARI, aksi: 'kirim' });
    const id = r.body.id;
    const edit = await request(app).put(`/api/jurnal/${id}`).set('Authorization', authz).send({ ...ISI(), tanggal: HARI });
    expect(edit.status).toBe(409);
    expect(edit.body).toMatchObject({ kode: 'STATUS_TIDAK_VALID' });
  });
});

/* ---------- Pemilikan dan akses ---------- */
describe('hak akses jurnal', () => {
  test('peserta membuka jurnal peserta lain -> 404 pada list dan detail', async () => {
    const { peserta } = await isiDasar();
    const lain = await buatUser({ nama: 'Farhan', username: 'farhan', email: 'farhan@astakira.id', role: 'peserta' });
    await (await M.Peserta.create({ user_id: lain.id, divisi: 'Videografi' }));
    const authz = await tokenUntuk(peserta.email);
    const authzLain = await tokenUntuk(lain.email);

    await request(app).post('/api/jurnal').set('Authorization', authzLain).send({ ...ISI(), tanggal: HARI });
    const listLain = await request(app).get('/api/jurnal').set('Authorization', authz);
    expect(listLain.body.data).toHaveLength(0);

    const id = (await M.Jurnal.findOne()).id;
    const detail = await request(app).get(`/api/jurnal/${id}`).set('Authorization', authz);
    expect(detail.status).toBe(404);
  });

  test('edit jurnal milik orang lain -> 404', async () => {
    const { peserta } = await isiDasar();
    const lain = await buatUser({ nama: 'Farhan', username: 'farhan', email: 'farhan@astakira.id', role: 'peserta' });
    await M.Peserta.create({ user_id: lain.id, divisi: 'Videografi' });
    const authzLain = await tokenUntuk(lain.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authzLain).send({ ...ISI(), tanggal: HARI });
    const id = r.body.id;

    const authz = await tokenUntuk(peserta.email);
    const edit = await request(app).put(`/api/jurnal/${id}`).set('Authorization', authz).send({ ...ISI(), tanggal: HARI });
    expect(edit.status).toBe(404);
  });
});

/* ---------- Validasi tanggal ---------- */
describe('validasi tanggal', () => {
  test.each([
    ['tanggal masa depan', { tanggal: hariDepan(1) }],
    ['lebih dari 7 hari ke belakang', { tanggal: hariLalu(8) }],
    ['format salah', { tanggal: '17-10-2026' }],
    ['tanggal tidak berguna', { tanggal: '2026-02-30' }],
    ['tanggal kosong', { tanggal: undefined }],
  ])('create %s -> 400 VALIDASI', async (_nama, badan) => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), tanggal: badan.tanggal });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ kode: 'VALIDASI' });
  });

  test('tanggal tepat 7 hari ke belakang diterima; hari ini diterima', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const a = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'Jurnal 7 hari', tanggal: hariLalu(7) });
    expect(a.status).toBe(201);
    const b = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'Jurnal hari ini', tanggal: HARI });
    expect(b.status).toBe(201);
  });

  test('update juga menolak tanggal tidak sah', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), tanggal: HARI });
    const id = r.body.id;
    const upd = await request(app).put(`/api/jurnal/${id}`).set('Authorization', authz).send({ ...ISI(), tanggal: hariDepan(2) });
    expect(upd.status).toBe(400);
    expect(upd.body).toMatchObject({ kode: 'VALIDASI' });
  });
});

/* ---------- Batas teks ---------- */
describe('batas panjang teks', () => {
  const judul151 = 'a'.repeat(151);
  const isi5001 = 'u'.repeat(5001);
  const isi5000 = 'u'.repeat(5000);

  test('judul 151 karakter -> 400', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: judul151, tanggal: HARI });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ kode: 'VALIDASI' });
  });

  test('uraian 5001 karakter -> 400; 5000 diterima', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const buruk = await request(app).post('/api/jurnal').set('Authorization', authz)
      .send({ ...ISI(), uraian: isi5001, tanggal: HARI });
    expect(buruk.status).toBe(400);
    const bagus = await request(app).post('/api/jurnal').set('Authorization', authz)
      .send({ ...ISI(), uraian: isi5000, tanggal: HARI });
    expect(bagus.status).toBe(201);
  });

  test('hasil/kendala/rencana 5001 karakter -> 400', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    for (const k of ['hasil', 'kendala', 'rencana']) {
      const r = await request(app).post('/api/jurnal').set('Authorization', authz)
        .send({ ...ISI(), [k]: isi5001, tanggal: HARI });
      expect(r.status).toBe(400);
    }
  });
});

/* ---------- Batas unik satu jurnal per hari ---------- */
describe('batas unik harian', () => {
  test('dua jurnal tanggal sama -> 409 JURNAL_ADA', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const r1 = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'Pagi', tanggal: HARI });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'Sore', tanggal: HARI });
    expect(r2.status).toBe(409);
    expect(r2.body).toMatchObject({ kode: 'JURNAL_ADA', pesan: 'Anda sudah punya jurnal untuk tanggal ini.' });
    expect(await M.Jurnal.count()).toBe(1);
  });

  test('tanggal berbeda boleh lebih dari satu', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const a = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'A', tanggal: HARI });
    const b = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'B', tanggal: hariLalu(1) });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  test('update tanggal (draft pindah hari) boleh selama tidak bentrok', async () => {
    const { peserta } = await isiDasar();
    const authz = await tokenUntuk(peserta.email);
    const a = await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'A', tanggal: HARI });
    await request(app).post('/api/jurnal').set('Authorization', authz).send({ ...ISI(), judul: 'B', tanggal: hariLalu(1) });
    // Pindah jurnal B ke hari ini -> bentrok
    const idB = await (await request(app).get('/api/jurnal').set('Authorization', authz))
      .body.data.find((x) => x.judul === 'B');
    const konflik = await request(app).put(`/api/jurnal/${idB.id}`).set('Authorization', authz).send({ ...ISI(), judul: 'B', tanggal: HARI });
    expect(konflik.status).toBe(409);
    expect(konflik.body).toMatchObject({ kode: 'JURNAL_ADA' });
    // Pindah ke hari kemarin dua -> tetap boleh (tanggal bebas)
    const aman = await request(app).put(`/api/jurnal/${a.body.id}`).set('Authorization', authz).send({ ...ISI(), judul: 'A-berubah', tanggal: hariLalu(2) });
    expect(aman.status).toBe(200);
    expect(aman.body.tanggal).toBe(hariLalu(2));
  });
});
