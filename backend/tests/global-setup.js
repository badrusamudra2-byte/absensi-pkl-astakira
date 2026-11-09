/** Menyiapkan database tes sekali per sesi jest: buat bila belum ada, lalu migrasi. */
const path = require('path');
const { execSync } = require('child_process');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = process.env.DB_NAME_TEST || 'absensi_pkl_test';

  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
  const mysql = require('mysql2/promise');

  const koneksi = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || undefined,
  });
  await koneksi.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await koneksi.end();

  execSync('npx sequelize-cli db:migrate', {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
};
