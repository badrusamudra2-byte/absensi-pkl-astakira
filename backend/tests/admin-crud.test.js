const request = require('supertest');
const app = require('../src/app');
const { kosongkanDb, isiDasar, tokenUntuk } = require('./helper');

let dasar, tokAdmin;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();
  tokAdmin = await tokenUntuk('admin@astakira.id');
});

describe('Kelola peserta dan pembimbing (admin)', () => {
  test('tambah peserta baru: profil dibuat dan sandi sementara tersimpan sebagai hash', async () => {
    const r = await request(app)
      .post('/api/admin/peserta')
      .set('Authorization', tokAdmin)
      .send({ nama: 'Nadia Puspa', email: 'nadia@astakira.id', divisi: 'Web', pembimbing_id: dasar.pembimbing.id });
    expect(r.status).toBe(201);
    expect(r.body.nama).toBe('Nadia Puspa');

    const M = require('../src/models');
    const u = await M.User.unscoped().findOne({ where: { email: 'nadia@astakira.id' } });
    expect(u.role).toBe('peserta');
    expect(u.password_hash.length).toBeGreaterThan(20);
    const profil = await M.Peserta.findOne({ where: { user_id: u.id } });
    expect(profil.divisi).toBe('Web');
    expect(profil.pembimbing_id).toBe(dasar.pembimbing.id);
  });

  test('kata sandi awal ditentukan admin: hash cocok dan plain text tidak bocor di respons', async () => {
    const r = await request(app)
      .post('/api/admin/peserta')
      .set('Authorization', tokAdmin)
      .send({ nama: 'Bagus Prakoso', email: 'bagus@astakira.id', password: 'sandi-admin-123', divisi: 'Web' });
    expect(r.status).toBe(201);
    const tubuh = JSON.stringify(r.body);
    expect(tubuh).not.toContain('sandi-admin-123');
    expect(tubuh).not.toContain('$2');

    // Login langsung dengan kata sandi yang ditentukan admin
    const masuk = await request(app).post('/api/auth/login').send({ identifier: 'bagus@astakira.id', password: 'sandi-admin-123' });
    expect(masuk.status).toBe(200);
    expect(masuk.body.user.nama).toBe('Bagus Prakoso');
  });

  test('kata sandi awal terlalu pendek ditolak (400 VALIDASI)', async () => {
    const r = await request(app)
      .post('/api/admin/peserta')
      .set('Authorization', tokAdmin)
      .send({ nama: 'Pendek', email: 'pendek@astakira.id', password: '1234567' });
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('VALIDASI');
  });

  test('kata sandi awal berlaku juga untuk pembimbing; kosong kembali ke sandi sementara otomatis', async () => {
    const pmb = await request(app)
      .post('/api/admin/pembimbing')
      .set('Authorization', tokAdmin)
      .send({ nama: 'Pembimbing Sandi', email: 'pmb-sandi@astakira.id', password: 'sandi-pembimbing', divisi: 'Web' });
    expect(pmb.status).toBe(201);

    const kosong = await request(app)
      .post('/api/admin/pembimbing')
      .set('Authorization', tokAdmin)
      .send({ nama: 'Pembimbing Otomatis', email: 'pmb-oto@astakira.id', password: '', divisi: 'Web' });
    expect(kosong.status).toBe(201);

    const M = require('../src/models');
    const u = await M.User.unscoped().findOne({ where: { email: 'pmb-oto@astakira.id' } });
    expect(u.password_hash.startsWith('$2')).toBe(true);
  });

  test('edit peserta: ganti nama, divisi, dan pembimbing', async () => {
    const pmbLain = await request(app)
      .post('/api/admin/pembimbing')
      .set('Authorization', tokAdmin)
      .send({ nama: 'Sinta Lestari', email: 'sinta@astakira.id', divisi: 'Web' });
    expect(pmbLain.status).toBe(201);
    const idPmb = pmbLain.body.id;

    const r = await request(app)
      .put(`/api/admin/peserta/${dasar.peserta.id}`)
      .set('Authorization', tokAdmin)
      .send({ nama: 'Alya Bimawati', divisi: 'Sosial Media', pembimbing_id: idPmb });
    expect(r.status).toBe(200);

    const M = require('../src/models');
    const profil = await M.Peserta.findOne({ where: { user_id: dasar.peserta.id } });
    expect(profil.pembimbing_id).toBe(idPmb);
    const u = await M.User.findByPk(dasar.peserta.id);
    expect(u.nama).toBe('Alya Bimawati');
  });

  test('pembimbing_id tidak valid ditolak', async () => {
    const r = await request(app)
      .put(`/api/admin/peserta/${dasar.peserta.id}`)
      .set('Authorization', tokAdmin)
      .send({ pembimbing_id: 99999 });
    expect(r.status).toBe(400);
  });

  test('nonaktifkan peserta menghapus template & verifikasi wajah', async () => {
    const M = require('../src/models');
    const { enc } = require('../src/utils/crypto');
    await M.FaceTemplate.create({
      user_id: dasar.peserta.id,
      embedding: enc(Array.from({ length: 128 }, (_, i) => (i % 2 ? -0.1 : 0.1))),
    });
    const r = await request(app)
      .put(`/api/admin/peserta/${dasar.peserta.id}`)
      .set('Authorization', tokAdmin)
      .send({ aktif: false });
    expect(r.status).toBe(200);
    expect(await M.FaceTemplate.count({ where: { user_id: dasar.peserta.id } })).toBe(0);
    expect((await M.User.findByPk(dasar.peserta.id)).aktif).toBe(false);
  });

  test('hapus aman: peserta dengan riwayat absensi ditolak (PUNYA_RIWAYAT)', async () => {
    const M = require('../src/models');
    const tgl = require('../src/utils/waktu').bagian().tanggal;
    await M.Absensi.create({
      user_id: dasar.peserta.id, tanggal: tgl, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah',
    });
    const r = await request(app).delete(`/api/admin/peserta/${dasar.peserta.id}`).set('Authorization', tokAdmin);
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('PUNYA_RIWAYAT');
    expect(await M.User.findByPk(dasar.peserta.id)).toBeTruthy();
  });

  test('hapus aman: peserta tanpa riwayat terhapus bersih profilnya', async () => {
    const M = require('../src/models');
    const r = await request(app).delete(`/api/admin/peserta/${dasar.nonaktif.id}`).set('Authorization', tokAdmin);
    expect(r.status).toBe(200);
    expect(await M.User.findByPk(dasar.nonaktif.id)).toBeNull();
    expect(await M.Peserta.count({ where: { user_id: dasar.nonaktif.id } })).toBe(0);
  });

  test('pembimbing yang masih membimbing tidak bisa dihapus', async () => {
    const r = await request(app).delete(`/api/admin/pembimbing/${dasar.pembimbing.id}`).set('Authorization', tokAdmin);
    expect(r.status).toBe(409);
    expect(r.body.kode).toBe('PUNYA_RIWAYAT');
  });

  test('peserta dan pembimbing tidak bisa mengakses CRUD admin', async () => {
    const tokPmb = await tokenUntuk('rizal@astakira.id');
    const a = await request(app).get('/api/admin/peserta').set('Authorization', tokPmb);
    expect(a.status).toBe(403);
    const b = await request(app).post('/api/admin/pembimbing').set('Authorization', tokPmb).send({});
    expect(b.status).toBe(403);
  });
});

describe('Jadwal kerja (workshift)', () => {
  const jadwal = () => ({
    items: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((h) => ({
      hari: h, hari_kerja: !['Sabtu', 'Minggu'].includes(h), jam_masuk: '08:00:00',
      jam_pulang: h === 'Jumat' ? '15:30:00' : '16:00:00', toleransi_menit: 15,
    })),
  });

  test('simpan 7 hari valid', async () => {
    const r = await request(app).put('/api/admin/workshift').set('Authorization', tokAdmin).send(jadwal());
    expect(r.status).toBe(200);
    const M = require('../src/models');
    const sabtu = await M.Workshift.findOne({ where: { hari: 'Sabtu' } });
    expect(sabtu.hari_kerja).toBe(false);
    const jumat = await M.Workshift.findOne({ where: { hari: 'Jumat' } });
    expect(jumat.jam_pulang).toBe('15:30:00');
  });

  test('jumlah hari salah, duplikat, jam pulang mundur, dan nama asing ditolak', async () => {
    const kurang = jadwal();
    kurang.items.pop();
    const a = await request(app).put('/api/admin/workshift').set('Authorization', tokAdmin).send(kurang);
    expect(a.status).toBe(400);

    const duplikat = jadwal();
    duplikat.items[1] = { ...duplikat.items[0] };
    const b = await request(app).put('/api/admin/workshift').set('Authorization', tokAdmin).send(duplikat);
    expect(b.status).toBe(400);

    const mundur = jadwal();
    mundur.items[0].jam_pulang = '07:00:00';
    const c = await request(app).put('/api/admin/workshift').set('Authorization', tokAdmin).send(mundur);
    expect(c.status).toBe(400);

    const asing = jadwal();
    asing.items[0].hari = 'HariKiamat';
    const d = await request(app).put('/api/admin/workshift').set('Authorization', tokAdmin).send(asing);
    expect(d.status).toBe(400);
  });

  test('toleransi di luar 0-120 ditolak', async () => {
    const t = jadwal();
    t.items[0].toleransi_menit = 500;
    const r = await request(app).put('/api/admin/workshift').set('Authorization', tokAdmin).send(t);
    expect(r.status).toBe(400);
  });
});
