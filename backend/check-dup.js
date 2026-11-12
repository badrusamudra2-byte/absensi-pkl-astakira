const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});
  const [rows] = await pool.query("SELECT id, user_id, tanggal, jenis, jam, pulang_jam, pulang_status FROM absensi WHERE user_id = 17 AND tanggal = '2026-11-10'");
  console.log('Rows for user 17 2026-11-10:', JSON.stringify(rows));
  await pool.end();
})();