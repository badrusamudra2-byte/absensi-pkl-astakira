// Alat sekali pakai: drop & create database dev + test sesuai .env (schema dibuat ulang lewat migrasi).
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const k = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  });
  const dev = process.env.DB_NAME || 'absensi_pkl';
  const tes = process.env.DB_NAME_TEST || 'absensi_pkl_test';
  for (const db of [dev, tes]) {
    await k.query('DROP DATABASE IF EXISTS `' + db + '`');
    await k.query('CREATE DATABASE `' + db + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  }
  console.log('Database', dev, 'dan', tes, 'dibuat ulang (tanpa menyebut kredensial).');
  await k.end();
})().catch((e) => {
  console.error('Gagal menyiapkan database:', e.sqlMessage || e.message);
  process.exit(1);
});
