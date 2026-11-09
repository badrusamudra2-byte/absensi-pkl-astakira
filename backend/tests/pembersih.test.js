const tutupHari = require('../src/services/tutup-hari');
const { bersihkan } = require('../src/services/jobs');
const { kosongkanDb, isiDasar } = require('./helper');
const M = require('../src/models');

let dasar;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();
});

describe('Job pembersih token lama', () => {
  test('menghapus token (kedaluwarsa maupun dipakai) lebih tua dari 24 jam, menyimpan yang baru', async () => {
    const M2 = require('../src/models');
    const lama = new Date(Date.now() - 2 * 86400000);
    const baru = new Date(Date.now() - 60 * 1000);

    await M2.TokenPembimbing.bulkCreate([
      { token_hash: 'e'.repeat(64), pembimbing_id: dasar.pembimbing.id, kedaluwarsa_pada: lama },
      { token_hash: 'f'.repeat(64), pembimbing_id: dasar.pembimbing.id, kedaluwarsa_pada: baru },
    ]);
    await M2.QrToken.bulkCreate([
      { token_hash: 'a'.repeat(64), user_id: dasar.peserta.id, jenis: 'masuk', kedaluwarsa_pada: lama },
      { token_hash: 'b'.repeat(64), user_id: dasar.peserta.id, jenis: 'masuk', kedaluwarsa_pada: lama, dipakai_pada: lama, dipindai_oleh: dasar.pembimbing.id },
      { token_hash: 'c'.repeat(64), user_id: dasar.peserta.id, jenis: 'pulang', kedaluwarsa_pada: baru },
    ]);
    await M2.FaceVerification.bulkCreate([
      { user_id: dasar.peserta.id, jenis: 'masuk', kedaluwarsa_pada: lama },
      { user_id: dasar.peserta.id, jenis: 'masuk', kedaluwarsa_pada: baru },
    ]);
    await M2.TantanganWajah.bulkCreate([
      { user_id: dasar.peserta.id, nonce_hash: 'd'.repeat(64), kode_gerakan: 'kedip', kedaluwarsa_pada: lama },
    ]);

    const hasil = await bersihkan();
    expect(hasil).toMatchObject({ token_pembimbing: 1, qr_tokens_lama: 2, face_verifications: 1, tantangan_wajah: 1 });
    expect(await M2.TokenPembimbing.count()).toBe(1); // token tayang yang masih hidup
    const tersisa = await M2.QrToken.count();
    expect(tersisa).toBe(1); // QR lama yang belum kedaluwarsa tetap hidup
  });

  test('idempotent: dijalankan ulang menghapus nol', async () => {
    await bersihkan();
    const dua = await bersihkan();
    expect(dua).toMatchObject({ token_pembimbing: 0, qr_tokens_lama: 0, face_verifications: 0, tantangan_wajah: 0 });
  });

  test('tidak mengganggu job penutup hari (modul terpisah tetap terekspor)', async () => {
    expect(typeof tutupHari).toBe('function');
    expect(typeof bersihkan).toBe('function');
  });
});
