/** Pengambilan lokasi perangkat (navigator.geolocation) untuk validasi absen.
 * Server yang memvalidasi jarak; modul ini hanya melaporkan posisi dengan
 * pesan galat Bahasa Indonesia yang jelas bila izin/GPS bermasalah. */

export interface TitikLokasi {
  lat: number;
  lng: number;
  akurasi_m: number;
}

/** Ambil posisi saat ini. enableHighAccuracy agar jarak ke kantor akurat. */
export function ambilLokasi(): Promise<TitikLokasi> {
  return new Promise((selesai, gagal) => {
    if (!('geolocation' in navigator)) {
      gagal(new Error('Perangkat atau browser ini tidak mendukung pelacakan lokasi.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => selesai({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        akurasi_m: p.coords.accuracy ?? 0,
      }),
      (e) => {
        const pesan =
          e.code === e.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini (ikon gembok di address bar) lalu coba lagi.'
            : e.code === e.POSITION_UNAVAILABLE
              ? 'Lokasi tidak tersedia. Pastikan layanan lokasi/GPS perangkat aktif lalu coba lagi.'
              : e.code === e.TIMEOUT
                ? 'Waktu mengambil lokasi habis. Cari tempat dengan sinyal GPS lebih baik lalu coba lagi.'
                : 'Lokasi gagal diambil. Coba lagi sebentar.';
        gagal(new Error(pesan));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}
