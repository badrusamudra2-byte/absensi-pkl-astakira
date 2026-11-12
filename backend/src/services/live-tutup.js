const { Op } = require('sequelize');
const { SesiTracking, Workshift, User } = require('../models');
const { bagian, menitDariJam } = require('../utils/waktu');
const live = require('../controllers/live');

/**
 * Job penutup sesi live tracking (idempotent): sesi aktif dari hari-hari sebelumnya
 * ditutup, dan pada hari kerja sesi hari ini ditutup setelah jam pulang + toleransi
 * (peserta lupa absen pulang). Posisi terakhir ikut dikosongkan di setiap penutupan.
 * @param {{sekarang?: Date}} opsi injeksi untuk pengujian
 */
const tutupLive = async ({ sekarang = new Date() } = {}) => {
  const w = bagian(sekarang);
  // Sisa sesi dari hari sebelumnya: pasti ditutup apa pun jadwalnya.
  const sisa = await SesiTracking.findAll({ where: { status: 'aktif', tanggal: { [Op.ne]: w.tanggal } } });
  let ditutup = 0;
  for (const s of sisa) {
    const t = await live.tutupSesi(s.user_id, 'otomatis');
    if (t) ditutup += 1;
  }

  // Hari ini: hanya bila sudah lewat jam pulang + toleransi workshift hari ini.
  const ws = await Workshift.findOne({ where: { hari: w.hari } });
  if (!ws || !ws.hari_kerja) return { ditutup: sisa.length, ditutupHariIni: 0 };

  const ambang = Math.min(menitDariJam(ws.jam_pulang) + ws.toleransi_menit, 23 * 60 + 59);
  if (w.menit < ambang) return { ditutup: sisa.length, ditutupHariIni: 0 };

  const peserta = await User.findAll({ where: { role: 'peserta', aktif: true }, attributes: ['id'] });
  let hariIni = 0;
  for (const p of peserta) {
    const sesi = await SesiTracking.findOne({ where: { user_id: p.id, status: 'aktif', tanggal: w.tanggal } });
    if (sesi) {
      const t = await live.tutupSesi(p.id, 'otomatis');
      if (t) hariIni += 1;
    }
  }
  return { tanggal: w.tanggal, ditutup: sisa.length, ditutupHariIni: hariIni };
};

module.exports = tutupLive;
