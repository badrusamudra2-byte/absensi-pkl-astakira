const { Op } = require('sequelize');
const tutupHari = require('./tutup-hari');
const tutupLive = require('./live-tutup');
const M = require('../models');

const lama = 24 * 3600 * 1000; // simpan maksimal 24 jam setelah kedaluwarsa
let timerJob = null;
let timerBer = null;
let timerLive = null;

/** Hapus token QR, verifikasi wajah, tantangan liveness, dan foto wajah lewat retensi.
 * Idempotent. */
const bersihkan = async () => {
  const batas = new Date(Date.now() - lama);
  const retensiFoto = new Date(Date.now() - require('../config/env').face.foto.retensiHari * 86400 * 1000);
  const [tayang, wajah, tantangan, foto] = await Promise.all([
    M.QrToken.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
    M.FaceVerification.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
    M.TantanganWajah.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
    M.WajahFoto.destroy({ where: { dibuat_pada: { [Op.lt]: retensiFoto } } }), // kolom createdAt = dibuat_pada
  ]);
  const hasil = { qr_tokens: tayang, face_verifications: wajah, tantangan_wajah: tantangan, wajah_foto: foto };
  if (tayang + wajah + tantangan + foto > 0) console.log('Pembersih token:', JSON.stringify(hasil));
  return hasil;
};

/** Jalankan job rutin di interval; tanpa efek bila dipanggil ulang. */
const mulai = (setiapMenit = 5) => {
  if (timerJob) return;
  const jalankan = async () => {
    try {
      const r = await tutupHari();
      if (r.dibuat) console.log(`Penutup hari: ${r.dibuat} peserta ditandai Tidak hadir (${r.tanggal}).`);
    } catch (e) {
      console.error('Job penutup hari gagal:', e.message);
    }
  };
  timerJob = setInterval(jalankan, setiapMenit * 60 * 1000);
  timerJob.unref?.();

  // Live tracking: sesi aktif ditutup otomatis pada jam pulang + toleransi.
  // Interval 1 menit agar peta tidak menyimpan sesi sesudah jam pulang terlalu lama.
  timerLive = setInterval(
    () => tutupLive().catch((e) => console.error('Job tutup live tracking gagal:', e.message)),
    60 * 1000,
  );
  timerLive.unref?.();

  // Pembersih sekali sehari (mulai 1 menit setelah server hidup)
  const ber = setTimeout(async () => {
    try {
      await bersihkan();
    } catch (e) {
      console.error('Job pembersih gagal:', e.message);
    }
  }, 60 * 1000);
  ber.unref?.();
  timerBer = setInterval(
    () => bersihkan().catch((e) => console.error('Job pembersih gagal:', e.message)),
    24 * 60 * 60 * 1000,
  );
  timerBer.unref?.();
};

module.exports = { mulai, bersihkan };
