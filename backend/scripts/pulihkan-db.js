// Alat pemulihan: bentuk ulang database sesuai .env lalu impor berkas backup mysqldump.
//   Pulihkan penuh : $env:MYSQL_PWD serupa .env; node scripts/pulihkan-db.js backup-absensi.sql
//   Tanpa impor   : node scripts/pulihkan-db.js            (hanya bentuk ulang struktur)
// Kredensial tidak pernah dicetak ke log.
require('dotenv').config();
const mysql = require('mysql2/promise');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASS ?? '';
  const k = await mysql.createConnection({ host, port, user, password: pass, multipleStatements: true });
  const dev = process.env.DB_NAME || 'absensi_pkl';
  const tes = process.env.DB_NAME_TEST || 'absensi_pkl_test';
  for (const db of [dev, tes]) {
    await k.query('DROP DATABASE IF EXISTS `' + db + '`');
    await k.query('CREATE DATABASE `' + db + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  }
  console.log('Database', dev, 'dan', tes, 'dibuat ulang (tanpa menyebut kredensial).');

  // Impor berkas backup bila diberikan lewat argumen.
  const berkas = process.argv[2];
  if (berkas) {
    const penuh = path.resolve(berkas);
    if (!fs.existsSync(penuh)) {
      throw new Error('Berkas backup tidak ditemukan: ' + penuh);
    }
    // mysql CLI mengeksekusi dump multi-pernyataan; mysql2 tidak mendukung restore dump.
    const mysqlBin = process.env.MYSQL_BIN || 'mysql';
    const args = ['-h', host, '-P', String(port), '-u', user, dev];
    if (!process.env.MYSQL_PWD) process.env.MYSQL_PWD = pass; // dibaca mysql CLI; jangan dicetak
    execFileSync(mysqlBin, args, { input: fs.readFileSync(penuh), stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
    console.log('Berkas backup selesai diimpor ke', dev, ':', path.basename(penuh));
  } else {
    console.log('Tanpa berkas backup: hanya struktur. Impor dump via: node scripts/pulihkan-db.js <berkas.sql>');
  }
  await k.end();
})().catch((e) => {
  console.error('Gagal memulihkan database:', e.sqlMessage || e.message);
  process.exit(1);
});
