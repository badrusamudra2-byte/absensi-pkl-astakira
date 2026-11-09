const tutupHari = require('../src/services/tutup-hari');
const { bersihkan } = require('../src/services/jobs');
const { kosongkanDb, isiDasar } = require('./helper');
const env = require('../src/config/env');
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
    expect(hasil).toMatchObject({ qr_tokens: 2, face_verifications: 1, tantangan_wajah: 1 });
    const tersisa = await M2.QrToken.count();
    expect(tersisa).toBe(1); // QR lama yang belum kedaluwarsa tetap hidup
  });

  test('foto wajah (wajah_foto) dihapus setelah FACE_FOTO_RETENSI_HARI', async () => {
    const ab = await M.Absensi.create({
      user_id: dasar.peserta.id, tanggal: '2026-06-15', jenis: 'masuk', jam: '08:00', status: 'Hadir', metode: 'QR+Wajah',
    });
    // dibuat_pada dimajukan melewati batas retensi lewat SQL mentah:
    const lewatRetensi = new Date(Date.now() - (env.face.foto.retensiHari + 1) * 86400 * 1000);
    // dibuat_pada baris pertama dimajukan melewati batas retensi (kolom createdAt bernama
    // alias 'dibuat_pada', jadi lewat SQL mentah; update alias tidak terpeta Sequelize):
    await M.WajahFoto.create({ absensi_id: ab.id, data: 'aaa.bbb.ccc' });
    await M.sequelize.query(
      'UPDATE wajah_foto SET dibuat_pada = :tugas WHERE absensi_id = :id',
      { replacements: { tugas: lewatRetensi, id: ab.id } },
    );
    const ab2 = await M.Absensi.create({
      user_id: dasar.pembimbing.id, tanggal: '2026-06-16', jenis: 'masuk', jam: '08:00', status: 'Hadir', metode: 'QR+Wajah',
    });
    await M.WajahFoto.create({ absensi_id: ab2.id, data: 'aaa.bbb.ccc' }); // createdAt = sekarang

    const hasil = await bersihkan();
    expect(hasil.wajah_foto).toBe(1);
    expect(await M.WajahFoto.count({ where: { absensi_id: ab.id } })).toBe(0); // lama terhapus
    expect(await M.WajahFoto.count({ where: { absensi_id: ab2.id } })).toBe(1); // baru tersisa
  });

  test('idempotent: dijalankan ulang menghapus nol', async () => {
    await bersihkan();
    const dua = await bersihkan();
    expect(dua).toMatchObject({ qr_tokens: 0, face_verifications: 0, tantangan_wajah: 0, wajah_foto: 0 });
  });

  test('tidak mengganggu job penutup hari (modul terpisah tetap terekspor)', async () => {
    expect(typeof tutupHari).toBe('function');
    expect(typeof bersihkan).toBe('function');
  });
});
