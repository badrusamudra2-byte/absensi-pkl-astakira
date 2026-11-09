const { PengaturanAbsensi } = require('../models');

/** Baris pengaturan tunggal (id=1) dibuat otomatis bila belum ada.
 * Singgahan 5 detik: perubahan admin cepat berlaku tanpa membebani DB. */
let singgahan = null;
let saatSinggahan = 0;

async function dapatkan() {
  const kini = Date.now();
  if (!singgahan || kini - saatSinggahan > 5000) {
    singgahan =
      (await PengaturanAbsensi.findByPk(1)) ||
      (await PengaturanAbsensi.create({ id: 1, metode: 'qr_wajah', liveness_aktif: true }));
    saatSinggahan = kini;
  }
  return singgahan;
}

// Dipanggil admin setelah update agar cache segera segar
function segarkan() {
  singgahan = null;
}

module.exports = { dapatkan, segarkan };
