const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});

  // Fix pulang_jam untuk id 4 - harusnya 14:57:57 (waktu pulang asli)
  await pool.query("UPDATE absensi SET pulang_jam = '14:57:57' WHERE id = 4");
  console.log('Fixed pulang_jam for id 4: set to 14:57:57');

  // Verify user 17
  const [rows] = await pool.query("SELECT id, user_id, tanggal, jenis, jam, pulang_jam, pulang_status, status FROM absensi WHERE user_id = 17 ORDER BY tanggal");
  console.log('User 17 setelah fix:', JSON.stringify(rows, null, 2));

  // Cek user lain apa saja ada pulang_status
  const [all] = await pool.query("SELECT id, user_id, tanggal, jenis, pulang_jam, pulang_status FROM absensi WHERE pulang_status IS NOT NULL");
  console.log('Semua rows dengan pulang_status:', JSON.stringify(all, null, 2));

  await pool.end();
})();