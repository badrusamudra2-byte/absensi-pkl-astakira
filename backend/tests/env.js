/** Dimuat jest sebelum modul aplikasi apa pun (lihat jest.config.js setupFiles).
 * Menunjuk koneksi ke database tes dan menonaktifkan sync. */
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'absensi_pkl_test';
process.env.DB_SYNC = 'false';
