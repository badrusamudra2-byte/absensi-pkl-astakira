const { asyncH, HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');
const { dapatkan, segarkan } = require('../services/pengaturan');

const METODE = ['qr_wajah', 'qr', 'wajah'];

// Semua peran yang sudah login boleh membaca (peserta/pembimbing perlu tahu alur absensi).
exports.lihat = asyncH(async (req, res) => {
  res.json(await dapatkan());
});

// Hanya admin yang boleh mengubah; masuk audit log
exports.ubah = asyncH(async (req, res) => {
  const b = req.body || {};
  const ubah = {};
  if (b.metode !== undefined) {
    if (!METODE.includes(b.metode)) {
      throw new HttpError(400, 'Metode harus salah satu dari qr_wajah, qr, atau wajah.', 'VALIDASI');
    }
    ubah.metode = b.metode;
  }
  if (b.liveness_aktif !== undefined) {
    if (typeof b.liveness_aktif !== 'boolean') {
      throw new HttpError(400, 'liveness_aktif harus true atau false.', 'VALIDASI');
    }
    ubah.liveness_aktif = b.liveness_aktif;
  }
  if (!Object.keys(ubah).length) {
    throw new HttpError(400, 'Tidak ada perubahan yang dikirim.', 'VALIDASI');
  }
  const p = await dapatkan();
  await p.update(ubah);
  segarkan();
  await audit(req, 'Ubah pengaturan absensi', JSON.stringify(ubah));
  res.json({ pesan: 'Pengaturan disimpan.', pengaturan: p });
});
