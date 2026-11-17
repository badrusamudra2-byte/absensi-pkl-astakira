/** Dimuat jest sebelum modul aplikasi apa pun (lihat jest.config.js setupFiles).
 * Menunjuk koneksi ke database tes, menonaktifkan sync, dan memindahkan folder
 * unggahan ke temp — berkas foto/bukti asli tidak pernah disentuh tes. */
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'absensi_pkl_test';
process.env.DB_SYNC = 'false';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR_TEST
  || path.join(os.tmpdir(), 'absensi-pkl-test-uploads');
