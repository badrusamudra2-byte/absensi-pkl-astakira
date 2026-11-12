const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});
  // Cek index apa saja
  const [idx] = await pool.query("SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'absensi' AND INDEX_NAME != 'PRIMARY'");
  console.log('Index non-primary:', JSON.stringify(idx, null, 2));
  
  // Buat unique index baru
  await pool.query("CREATE UNIQUE INDEX uq_absensi_harian ON absensi (user_id, tanggal)");
  console.log('Index uq_absensi_harian berhasil dibuat');
  
  // Verify
  const [idx2] = await pool.query("SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'absensi' AND INDEX_NAME != 'PRIMARY'");
  console.log('Setelah dibuat:', JSON.stringify(idx2, null, 2));
  await pool.end();
})();