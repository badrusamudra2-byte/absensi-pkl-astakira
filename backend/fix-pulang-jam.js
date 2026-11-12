const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});

  // Fix: Transfer jam dari pulang row ke pulang_jam di row masuk
  // Cari rows yang punya pulang_status tapi pulang_jam null
  const [rows] = await pool.query("SELECT id, jam, pulang_jam, pulang_status FROM absensi WHERE pulang_status IS NOT NULL AND pulang_jam IS NULL");
  console.log('Rows needing pulang_jam fix:', JSON.stringify(rows));

  for (const row of rows) {
    await pool.query(
      "UPDATE absensi SET pulang_jam = ? WHERE id = ?",
      [row.jam, row.id]
    );
    console.log(`Fixed pulang_jam for id ${row.id}: set to ${row.jam}`);
  }

  // Verify
  const [fixedRows] = await pool.query("SELECT id, user_id, tanggal, jenis, jam, pulang_jam, pulang_status, status FROM absensi WHERE user_id = 17 ORDER BY tanggal");
  console.log('User 17 setelah fix pulang_jam:', JSON.stringify(fixedRows, null, 2));

  await pool.end();
})();