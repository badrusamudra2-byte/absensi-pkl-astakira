const { Op } = require('sequelize');
const tutupHari = require('./tutup-hari');
const M = require('../models');

const lama = 24 * 3600 * 1000; // simpan maksimal 24 jam setelah kedaluwarsa
let timerJob = null;
let timerBer = null;

/** Hapus token tayang QR, verifikasi wajah, dan tantangan liveness yang lama. Idempotent. */
const bersihkan = async () => {
  const batas = new Date(Date.now() - lama);
  const [tayang, wajah, tantangan, lamaQr] = await Promise.all([
    M.TokenPembimbing.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
    M.FaceVerification.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
    M.TantanganWajah.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
    // Sisa alur lama (qr_tokens) turut dibersihkan
    M.QrToken.destroy({ where: { kedaluwarsa_pada: { [Op.lt]: batas } } }),
  ]);
  const hasil = { token_pembimbing: tayang, face_verifications: wajah, tantangan_wajah: tantangan, qr_tokens_lama: lamaQr };
  if (tayang + wajah + tantangan + lamaQr > 0) console.log('Pembersih token:', JSON.stringify(hasil));
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
