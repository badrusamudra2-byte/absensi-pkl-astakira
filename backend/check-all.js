const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});
  const [rows] = await pool.query("SELECT id, user_id, tanggal, DATE(tanggal) as tgl, jenis, jam, pulang_jam, pulang_status FROM absensi WHERE user_id = 17 ORDER BY tanggal");
  console.log('All rows user 17:', JSON.stringify(rows, null, 2));
  await pool.end();
})();