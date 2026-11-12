const { HttpError } = require('./httpError');

// Haversine (meter): jarak titik antar dua koordinat lintang/bujur derajat.
function jarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radius bumi (meter)
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const diRentang = (n, min, maks) => Number.isFinite(n) && n >= min && n <= maks;

/** Ambil & sahkan koordinat dari badan permintaan klien.
 * Mengembalikan null bila klien tidak mengirim lokasi sama sekali
 * (kolom angka absen), bukan galat — kebijakan wajib/tidaknya ditentukan pemanggil. */
function bacaLokasi(badan = {}) {
  const { lat, lng, akurasi_m } = badan;
  if (lat === undefined && lng === undefined && akurasi_m === undefined) return null;
  const a = Number(lat), b = Number(lng), c = akurasi_m === undefined ? undefined : Number(akurasi_m);
  if (!diRentang(a, -90, 90) || !diRentang(b, -180, 180)) {
    throw new HttpError(400, 'Koordinat tidak sah (lat -90..90, lng -180..180).', 'VALIDASI');
  }
  if (c !== undefined && !(Number.isFinite(c) && c >= 0 && c <= 100000)) {
    throw new HttpError(400, 'Nilai akurasi GPS tidak sah.', 'VALIDASI');
  }
  return { lat: a, lng: b, akurasi_m: c === undefined ? null : c };
}

/** Validasi jarak di server (sumber kebenaran waktu, status, dan kini juga lokasi).
 * Bila kantor belum diatur (lat/lng kantor NULL), lokasi tidak diwajibkan dan
 * dikembalikan kosong — alur absensi lama tidak berubah. */
function sahkanLokasi(cfg, titik, subjek = 'Anda') {
  if (cfg.lat_kantor === null || cfg.lat_kantor === undefined ||
      cfg.lng_kantor === null || cfg.lng_kantor === undefined) {
    return {};
  }
  const radius = cfg.radius_m ?? 100;
  const ambang = cfg.akurasi_maks_m ?? 50;
  if (!titik) {
    throw new HttpError(422, 'Lokasi tidak terbaca. Izinkan akses lokasi dan nyalakan GPS, lalu coba lagi.', 'LOKASI_DIBUTUHKAN');
  }
  if (titik.akurasi_m !== null && titik.akurasi_m > ambang) {
    throw new HttpError(
      422,
      `Sinyal GPS kurang akurat (±${Math.round(titik.akurasi_m)} m, maksimal ±${ambang} m). Cari tempat terbuka lalu coba lagi.`,
      'AKURASI_BURUK',
    );
  }
  const jarak = jarakMeter(titik.lat, titik.lng, cfg.lat_kantor, cfg.lng_kantor);
  if (jarak > radius) {
    throw new HttpError(
      422,
      `Posisi ${subjek} ±${Math.round(jarak)} m dari kantor (maksimal ${radius} m). Absen harus dilakukan di dalam area kantor.`,
      'DI_LUAR_RADIUS',
    );
  }
  return {
    lat: titik.lat, lng: titik.lng, akurasi_m: titik.akurasi_m,
    jarak_m: Math.round(jarak), di_dalam_area: jarak <= radius,
  };
}

module.exports = { jarakMeter, bacaLokasi, sahkanLokasi };
