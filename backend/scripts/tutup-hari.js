// Menjalankan job penutup hari secara manual (untuk uji coba dan backfill):
//   npm run tutup-hari                -> tanggal hari ini (zona TZ_APLIKASI)
//   npm run tutup-hari -- 2026-10-15  -> tanggal tertentu (masa lalu saja)
// Idempotent: peserta yang sudah punya catatan absensi tidak ditandai dua kali.
const tutupHari = require('../src/services/tutup-hari');
const { sequelize } = require('../src/models');

(async () => {
  const tanggal = process.argv[2] || undefined;
  try {
    const r = await tutupHari(tanggal ? { tanggal } : {});
    if (r.dibuat) {
      console.log(`Penutup hari ${r.tanggal} (${r.hari}): ${r.dibuat} peserta ditandai Tidak hadir.`);
    } else {
      console.log(`Penutup hari ${r.tanggal} (${r.hari}): tidak ada yang ditandai${r.hari && ['Sabtu', 'Minggu'].includes(r.hari) ? ' (libur)' : ''}.`);
    }
    process.exit(0);
  } catch (e) {
    console.error('Gagal menjalankan penutup hari:', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
