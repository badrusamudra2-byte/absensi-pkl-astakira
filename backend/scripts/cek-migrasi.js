require('dotenv').config();
const p = require('mysql2/promise');
(async () => {
  const c = await p.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASS,
  });
  try {
    for (const db of ['absensi_pkl', 'absensi_pkl_test']) {
      const [v] = await c.query(`SELECT name FROM \`${db}\`.sequelizemeta ORDER BY name DESC LIMIT 1`);
      console.log(db, '- migrasi terakhir:', v[0]?.name ?? 'TIDAK ADA');
      const [kol] = await c.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = ? AND column_name IN ('keterangan','detail')`,
        [db],
      );
      console.log(db, '- kolom baru:', kol.map((k) => `${k.TABLE_NAME}.${k.COLUMN_NAME}`).join(', ') || 'TIDAK ADA');
    }
  } finally {
    await c.end();
  }
})().catch((x) => { console.log('GAGAL:', x.message); process.exit(0); });
