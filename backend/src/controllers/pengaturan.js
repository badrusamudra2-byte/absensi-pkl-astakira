const { asyncH, HttpError } = require('../utils/httpError');
const audit = require('../utils/audit');
const { dapatkan, segarkan } = require('../services/pengaturan');

const METODE = ['qr_wajah', 'qr', 'wajah'];

// Rentang pengaturan lokasi kantor
const RADIUS_MIN = 20, RADIUS_MAKS = 10000;
const AKURASI_MIN = 5, AKURASI_MAKS = 500;

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
  // Area kantor: null = validasi lokasi nonaktif; angka = koordinat desimal
  const koordinat = (v, nama, min, maks) => {
    if (v === null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > maks) {
      throw new HttpError(400, `${nama} harus angka ${min} sampai ${maks} (atau null untuk menonaktifkan).`, 'VALIDASI');
    }
    return n;
  };
  if (b.lat_kantor !== undefined) ubah.lat_kantor = koordinat(b.lat_kantor, 'lat_kantor', -90, 90);
  if (b.lng_kantor !== undefined) ubah.lng_kantor = koordinat(b.lng_kantor, 'lng_kantor', -180, 180);
  if (b.radius_m !== undefined) {
    if (!Number.isInteger(Number(b.radius_m)) || Number(b.radius_m) < RADIUS_MIN || Number(b.radius_m) > RADIUS_MAKS) {
      throw new HttpError(400, `radius_m harus bilangan bulat ${RADIUS_MIN} sampai ${RADIUS_MAKS} meter.`, 'VALIDASI');
    }
    ubah.radius_m = Number(b.radius_m);
  }
  if (b.akurasi_maks_m !== undefined) {
    if (!Number.isInteger(Number(b.akurasi_maks_m)) || Number(b.akurasi_maks_m) < AKURASI_MIN || Number(b.akurasi_maks_m) > AKURASI_MAKS) {
      throw new HttpError(400, `akurasi_maks_m harus bilangan bulat ${AKURASI_MIN} sampai ${AKURASI_MAKS} meter.`, 'VALIDASI');
    }
    ubah.akurasi_maks_m = Number(b.akurasi_maks_m);
  }
  if (!Object.keys(ubah).length) {
    throw new HttpError(400, 'Tidak ada perubahan yang dikirim.', 'VALIDASI');
  }
  const p = await dapatkan();
  // Pasangan koordinat dan radius vs akurasi dicek setelah gabungan nilai lama+baru
  // (properti bisa null atau undefined pada baris baru — keduanya dianggap kosong)
  const kosong = (v) => v === null || v === undefined;
  const lat = ubah.lat_kantor !== undefined ? ubah.lat_kantor : p.lat_kantor;
  const lng = ubah.lng_kantor !== undefined ? ubah.lng_kantor : p.lng_kantor;
  if (kosong(lat) !== kosong(lng)) {
    throw new HttpError(400, 'lat_kantor dan lng_kantor harus diisi (atau dikosongkan) berpasangan.', 'VALIDASI');
  }
  const radius = ubah.radius_m !== undefined ? ubah.radius_m : p.radius_m;
  const ambang = ubah.akurasi_maks_m !== undefined ? ubah.akurasi_maks_m : p.akurasi_maks_m;
  if (radius < ambang) {
    throw new HttpError(400, `radius_m (${radius} m) harus minimal sebesar akurasi_maks_m (${ambang} m) agar GPS bisa lolos.`, 'VALIDASI');
  }
  await p.update(ubah);
  segarkan();
  await audit(req, 'Ubah pengaturan absensi', JSON.stringify(ubah));
  res.json({ pesan: 'Pengaturan disimpan.', pengaturan: p });
});
