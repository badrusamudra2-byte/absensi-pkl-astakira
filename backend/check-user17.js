const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});
  const [rows] = await pool.query('SELECT id, user_id, tanggal, jenis, jam, pulang_jam, pulang_status, status FROM absensi WHERE user_id = 17 ORDER BY tanggal');
  console.log('User 17:', JSON.stringify(rows, null, 2));
  await pool.end();
})();