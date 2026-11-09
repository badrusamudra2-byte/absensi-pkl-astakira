require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const k = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  });
  const [db] = await k.query('SHOW DATABASES');
  console.log('>>> Database yang ada:');
  for (const d of db) console.log(' -', Object.values(d)[0]);

  const nama = process.env.DB_NAME;
  await k.query('USE `' + nama + '`');
  const [t] = await k.query('SHOW TABLES');
  console.log('\n>>> Tabel di ' + nama + ' (hasil migrasi):');
  for (const row of t) {
    const tb = Object.values(row)[0];
    const [c] = await k.query('SELECT COUNT(*) AS n FROM `' + tb + '`');
    console.log(' -', tb.padEnd(24), 'baris:', c[0].n);
  }
  await k.end();
})().then(() => process.exit(0)).catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
