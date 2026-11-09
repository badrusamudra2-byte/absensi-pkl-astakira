const { bagian, HARI, menitDariJam } = require('../src/utils/waktu');
const tutupHari = require('../src/services/tutup-hari');
const { kosongkanDb, isiDasar, buatUser } = require('./helper');
const M = require('../src/models');

const TGL_KINI = bagian().tanggal;

const tglLalu = (n) => new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const tglDepan = (n) => new Date(Date.parse(`${TGL_KINI}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const namaHari = (t) => HARI[new Date(`${t}T00:00:00Z`).getUTCDay()];
const cariHariKerjaLalu = () => { for (let i = 1; i < 15; i++) { const t = tglLalu(i); if (namaHari(t) !== 'Sabtu' && namaHari(t) !== 'Minggu') return t; } throw new Error('tidak ada hari kerja'); };
const cariHariLiburLalu = () => { for (let i = 1; i < 8; i++) { const t = tglLalu(i); if (namaHari(t) === 'Minggu') return t; } throw new Error('tidak ada hari Minggu'); };

// Membuat Date yang bermakna jam HH:MM zona waktu aplikasi untuk tanggal tertentu
const sekarangJam = (tanggal, jam) => new Date(Date.parse(`${tanggal}T00:00:00Z`) + (jam - 7) * 3600000);

let dasar;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();
  // Tambah satu peserta aktif lagi agar job diproses dua orang
  const budi = await buatUser({ nama: 'Budi Setia', username: 'budi', email: 'budi@astakira.id', role: 'peserta' });
  await M.Peserta.create({ user_id: budi.id, divisi: 'Web', pembimbing_id: dasar.pembimbing.id });
  // Kasus "hari ini" butuh ambang; paksa hari ini jadi hari kerja
  await M.Workshift.update(
    { hari_kerja: true, jam_masuk: '08:00:00', jam_pulang: '16:00:00', toleransi_menit: 15 },
    { where: { hari: namaHari(TGL_KINI) } },
  );
});

describe('Job penutup hari (Tidak hadir otomatis)', () => {
  test('hari kerja: peserta aktif tanpa absensi ditandai Tidak hadir, nonaktif dilewati', async () => {
    const t = cariHariKerjaLalu();
    const r = await tutupHari({ tanggal: t });
    expect(r.dibuat).toBe(2);
    const baris = await M.Absensi.findAll({ where: { tanggal: t } });
    expect(baris).toHaveLength(2); // psr aktif + budi; pnr nonaktif tidak
    for (const b of baris) {
      expect(b.status).toBe('Tidak hadir');
      expect(b.metode).toBe('Otomatis');
      expect(b.jenis).toBe('masuk');
    }
  });

  test('idempotent: dijalankan dua kali hasil tetap sama', async () => {
    const t = cariHariKerjaLalu();
    await tutupHari({ tanggal: t });
    const r2 = await tutupHari({ tanggal: t });
    expect(r2.dibuat).toBe(0);
    expect(await M.Absensi.count({ where: { tanggal: t, status: 'Tidak hadir' } })).toBe(2);
  });

  test('peserta yang sudah absen masuk tidak ditandai', async () => {
    const t = cariHariKerjaLalu();
    await M.Absensi.create({
      user_id: dasar.peserta.id, tanggal: t, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah',
    });
    const r = await tutupHari({ tanggal: t });
    expect(r.dibuat).toBe(1);
    expect(await M.Absensi.count({ where: { user_id: dasar.peserta.id, tanggal: t } })).toBe(1);
  });

  test('hari libur tidak menandai apa pun', async () => {
    const r = await tutupHari({ tanggal: cariHariLiburLalu() });
    expect(r.dibuat).toBe(0);
    expect(await M.Absensi.count()).toBe(0);
  });

  test('hari ini sebelum ambang (jam pulang + selisih) belum ditandai', async () => {
    // 08:20 (480 menit) selalu di bawah ambang standar (16:00 + 60 = 1020 menit)
    const r = await tutupHari({ tanggal: TGL_KINI, sekarang: sekarangJam(TGL_KINI, 480 / 60) });
    expect(r.dibuat).toBe(0);
    expect(await M.Absensi.count({ where: { tanggal: TGL_KINI } })).toBe(0);
  });

  test('hari ini setelah ambang ditandai', async () => {
    // 20:00 (menit 1200) selalu di atas ambang standar (jam pulang paling lambat 16:00 + 60)
    const r = await tutupHari({ tanggal: TGL_KINI, sekarang: sekarangJam(TGL_KINI, 20) });
    expect(r.dibuat).toBe(2);
    expect(await M.Absensi.count({ where: { tanggal: TGL_KINI, status: 'Tidak hadir' } })).toBe(2);
  });

  test('tanggal masa depan tidak diproses', async () => {
    const r = await tutupHari({ tanggal: tglDepan(1) });
    expect(r.dibuat).toBe(0);
    expect(await M.Absensi.count()).toBe(0);
  });
});
