const { Workshift, Absensi, User } = require('../models');
const env = require('../config/env');
const { HARI, bagian, menitDariJam } = require('../utils/waktu');

/**
 * Job penutup hari (idempotent): pada hari kerja, setelah jam pulang + selisih
 * env.tutupHari.menit, peserta aktif tanpa catatan absensi apa pun hari itu
 * diberi baris status 'Tidak hadir' (jenis masuk, metode 'Otomatis').
 * Aman dijalankan berulang: baris yang sudah ada dilewati (batas unik harian).
 * @param {{tanggal?: string, sekarang?: Date}} opsi injeksi untuk pengujian/backfill
 */
const tutupHari = async ({ tanggal = bagian().tanggal, sekarang = new Date() } = {}) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error('Tanggal harus berformat YYYY-MM-DD.');
  const bag = bagian(sekarang);
  const hari = HARI[new Date(`${tanggal}T00:00:00Z`).getUTCDay()];

  const ws = await Workshift.findOne({ where: { hari } });
  if (!ws || !ws.hari_kerja) return { tanggal, hari, dibuat: 0 };

  if (tanggal > bag.tanggal) return { tanggal, hari, dibuat: 0 };
  // Untuk hari ini: belum lewat jam pulang + selisih -> belum saatnya menutup.
  // Bila ambang melewati tengah malam (jam_pulang terlambat), ambang dipotong ke
  // 23:59 agar hari tetap ditutup, bukan terlewat selamanya.
  const ambang = Math.min(menitDariJam(ws.jam_pulang) + env.tutupHari.menit, 23 * 60 + 59);
  if (tanggal === bag.tanggal && bag.menit < ambang) {
    return { tanggal, hari, dibuat: 0 };
  }

  const peserta = await User.findAll({ where: { role: 'peserta', aktif: true }, attributes: ['id'] });
  if (!peserta.length) return { tanggal, hari, dibuat: 0 };
  const sudah = await Absensi.findAll({
    where: { user_id: peserta.map((p) => p.id), tanggal },
    attributes: ['user_id'],
  });
  const tanpa = peserta.filter((p) => !sudah.some((s) => s.user_id === p.id)).map((p) => p.id);

  let dibuat = 0;
  for (const uid of tanpa) {
    try {
      await Absensi.create({
        user_id: uid, tanggal, jenis: 'masuk', jam: '00:00:00',
        status: 'Tidak hadir', metode: 'Otomatis',
      });
      dibuat += 1;
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') continue; // sudah ditandai sebelumnya
      throw e;
    }
  }
  return { tanggal, hari, dibuat, dinilai: tanpa.length };
};

module.exports = tutupHari;
