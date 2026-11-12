const mysql = require('mysql2/promise');
const { db: cfg } = require('./src/config/env');

(async () => {
  const pool = mysql.createPool({host: cfg.host, port: cfg.port||3306, user: cfg.user, password: cfg.pass, database: cfg.name});

  // 1. Ambil data pulang (id 7) untuk di-transfer ke masuk (id 4)
  const [pulang] = await pool.query("SELECT id, jam, pulang_jam, pulang_status FROM absensi WHERE id = 7");
  console.log('Data pulang (id 7):', JSON.stringify(pulang));

  // 2. Update row masuk (id 4) dengan pulang_jam dan pulang_status
  const [updateResult] = await pool.query(
    "UPDATE absensi SET pulang_jam = ?, pulang_status = ?, status = 'Hadir' WHERE id = 4",
    [pulang[0].pulang_jam || null, pulang[0].pulang_status || 'Hadir']
  );
  console.log('Update result:', updateResult.affectedRows, 'row(s) updated');

  // 3. Hapus row pulang lama (id 7) karena sudah digabungkan
  const [deleteResult] = await pool.query("DELETE FROM absensi WHERE id = 7");
  console.log('Delete result:', deleteResult.affectedRows, 'row(s) deleted');

  // 4. Cek sisa data user 17
  const [rows] = await pool.query("SELECT id, user_id, tanggal, jenis, jam, pulang_jam, pulang_status, status FROM absensi WHERE user_id = 17 ORDER BY tanggal");
  console.log('Sisa data user 17 setelah consolidasi:', JSON.stringify(rows, null, 2));

  await pool.end();
})();