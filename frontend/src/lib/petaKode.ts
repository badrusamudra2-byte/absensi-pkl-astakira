/** Semua kode galat API dari tabel backend/README.md dipetakan ke pesan UI.
 * Format: [judul, uraian]. Bila kode belum terdaftar, pakai pesan server langsung. */
export const PETA: Record<string, [string, string]> = {
  // Galat absensi QR (pindaian peserta)
  QR_TIDAK_VALID: ['QR tidak valid', 'Kode ini bukan QR absensi Astakira Media. Scan kode QR yang ditayangkan pembimbing.'],
  QR_KEDALUWARSA: ['QR kedaluwarsa', 'QR sudah berganti. Scan ulang QR yang sedang tampil di layar pembimbing.'],
  QR_SUDAH_DIPAKAI: ['QR sudah dipakai', 'QR ini sudah terekam absensi. Minta pembimbing menayangkan QR baru.'],
  SUDAH_ABSEN: ['Sudah absen hari ini', ''],
  BUKAN_BIMBINGAN: ['Bukan bimbingan pemberi QR', 'Anda tidak berada di bawah bimbingan pembimbing yang menayangkan QR ini.'],
  WAJAH_TIDAK_TERBACA: ['Wajah tidak terbaca', 'Hadapkan wajah lurus ke kamera di dalam bingkai dan cari tempat dengan cahaya cukup.'],
  WAJAH_TIDAK_COCOK: ['Wajah tidak cocok', 'Wajah tidak sesuai dengan template yang terdaftar. Coba lagi.'],
  PERSETUJUAN_WAJIB: ['Persetujuan dibutuhkan', 'Beri tanda persetujuan penggunaan data wajah terlebih dahulu.'],
  TEMPLATE_ADA: ['Wajah sudah terdaftar', 'Template wajah sudah ada. Hubungi admin untuk mendaftar ulang.'],
  TEMPLATE_BELUM: ['Wajah belum terdaftar', 'Daftarkan wajah Anda terlebih dahulu dari menu Pendaftaran wajah.'],
  TANTANGAN_WAJIB: ['Tantangan belum selesai', 'Selesaikan gerakan yang diminta sebelum lanjut.'],
  TANTANGAN_TAK_ADA: ['Tantangan tidak dikenali', 'Minta tantangan baru lalu ulangi gerakan.'],
  TANTANGAN_KEDALUWARSA: ['Tantangan kedaluwarsa', 'Waktu Anda habis. Minta tantangan baru lalu ulangi gerakan.'],
  TANTANGAN_SUDAH: ['Tantangan sudah dipakai', 'Minta tantangan baru lalu ulangi gerakan.'],
  MODE_QR_NONAKTIF: ['Metode QR tidak aktif', 'Metode absensi saat ini tidak memakai QR. Gunakan verifikasi wajah.'],
  MODE_WAJAH_NONAKTIF: ['Metode wajah tidak aktif', 'Metode absensi saat ini tidak memakai verifikasi wajah langsung.'],
  BELUM_ABSEN_MASUK: ['Belum absen masuk', 'Absen pulang hanya bisa dilakukan setelah absen masuk tercatat.'],
  PULANG_WAJAH: ['Pulang lewat wajah', 'Absen pulang dilakukan dengan verifikasi wajah, tanpa QR. Buka menu absensi lalu pilih Absen pulang.'],
  PULANG_BELUM_WAKTUNYA: ['Belum waktunya pulang', 'Absen pulang dibuka 5 menit sebelum jam pulang. Coba lagi saat waktunya tiba.'],
  HARI_LIBUR: ['Hari libur', 'Hari ini bukan hari kerja sesuai jadwal workshift.'],
  HARI_TERCATAT: ['Hari sudah tercatat', 'Hari itu tercatat Izin/Sakit — peserta tidak perlu dan tidak bisa absen.'],
  CATATAN_ADA: ['Catatan sudah ada', 'Sudah ada catatan izin/sakit atau absensi untuk tanggal itu.'],
  ALASAN_WAJIB: ['Alasan wajib diisi', 'Tulis alasan koreksi (minimal 3 karakter) agar perubahan terdokumentasi.'],
  PUNYA_RIWAYAT: ['Punya riwayat', 'Data ini sudah dipakai, jadi hanya bisa dinonaktifkan — bukan dihapus.'],

  // Galat baku (README backend)
  JURNAL_ADA: ['Jurnal sudah ada', 'Anda sudah punya jurnal untuk tanggal ini. Pilih tanggal lain atau ubah jurnal tersebut.'],
  STATUS_TIDAK_VALID: ['Jurnal tidak bisa diubah', 'Jurnal yang sudah dikirim atau disetujui tidak bisa diubah.'],
  VALIDASI: ['Data tidak valid', 'Periksa kembali isian lalu coba lagi.'],
  BELUM_LOGIN: ['Belum masuk', 'Silakan login terlebih dahulu.'],
  SESI_HABIS: ['Sesi berakhir', 'Silakan login ulang.'],
  NONAKTIF: ['Akun nonaktif', 'Hubungi admin untuk mengaktifkan kembali akun Anda.'],
  DILARANG: ['Tidak diizinkan', 'Anda tidak punya akses ke fitur ini.'],
  TIDAK_ADA: ['Tidak ditemukan', ''],
  DUPLIKAT: ['Data sudah ada', 'Email atau data yang sama sudah terdaftar.'],
  RATE_LIMIT: ['Terlalu banyak percobaan', 'Coba lagi beberapa saat lagi.'],
  SERVER: ['Kesalahan server', 'Terjadi gangguan pada server. Coba lagi sebentar.'],
};

export function teksKode(kode: string, pesanServer?: string): [string, string] {
  const p = PETA[kode];
  const judul = p?.[0] ?? 'Terjadi kendala';
  const uraian = pesanServer || p?.[1] || 'Coba lagi sebentar.';
  return [judul, uraian];
}
