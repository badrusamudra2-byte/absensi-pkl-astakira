const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});

  // Hapus index lama kalau ada
  try {
    await pool.query("DROP INDEX uq_absensi_harian ON absensi");
    console.log('Index lama dihapus');
  } catch(e) {
    console.log('Tidak ada index lama untuk dihapus atau sudah hilang');
  }

  // Buat unique index baru tanpa 'jenis'
  await pool.query("CREATE UNIQUE INDEX uq_absensi_harian ON absensi (user_id, tanggal)");
  console.log('Index uq_absensi_harian baru berhasil dibuat');

  // Verify
  const [idx] = await pool.query("SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'absensi' AND INDEX_NAME != 'PRIMARY'");
  console.log('Index non-primary setelah dibuat:', JSON.stringify(idx, null, 2));

  await pool.end();
})();