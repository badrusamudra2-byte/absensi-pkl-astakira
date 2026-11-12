const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});

  // 1. Cek data lama user 17
  const [rows] = await pool.query("SELECT id, user_id, tanggal, jenis, jam, pulang_jam, pulang_status, status FROM absensi WHERE user_id = 17 ORDER BY tanggal");
  console.log('Data lama user 17 sebelum reset:', JSON.stringify(rows, null, 2));

  // 2. Hapus semua absensi user 17
  const [del] = await pool.query("DELETE FROM absensi WHERE user_id = 17");
  console.log('Baris dihapus:', del.affectedRows);

  // 3. Verifikasi kosong
  const [remaining] = await pool.query("SELECT id FROM absensi WHERE user_id = 17");
  console.log('Sisa baris user 17:', remaining.length);

  await pool.end();
})();