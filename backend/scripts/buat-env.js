// Membuat backend/.env dari .env.example dengan nilai acak (JWT_SECRET, FACE_KEY).
// DB_PASS kosong — diisi manual oleh pengguna. JANGAN commit file ini hasilannya (.env).
const c = require('crypto');
const fs = require('fs');

const isi = [
  'NODE_ENV=development',
  'PORT=4000',
  'TZ_APLIKASI=Asia/Jakarta',
  'TRUST_PROXY=false',
  '',
  'DB_HOST=127.0.0.1',
  'DB_PORT=3306',
  'DB_NAME=absensi_pkl',
  'DB_USER=root',
  'DB_PASS=',
  'DB_SYNC=false',
  '',
  'JWT_SECRET=' + c.randomBytes(48).toString('hex'),
  'JWT_EXPIRES=8h',
  '',
  'FACE_KEY=' + c.randomBytes(32).toString('hex'),
  'FACE_THRESHOLD=0.5',
  'FACE_DIM=128',
  'FACE_VERIFY_TTL_DETIK=180',
  '',
  'QR_TTL_DETIK=30',
  'SCAN_KONFIRMASI_DETIK=120',
  '',
  'CORS_ORIGIN=http://localhost:3000',
  'FRONTEND_URL=http://localhost:3000',
  '',
  'SMTP_HOST=',
  'SMTP_PORT=587',
  'SMTP_USER=',
  'SMTP_PASS=',
  'MAIL_FROM=Astakira Media <no-reply@astakira.id>',
  '',
  '# Dipakai oleh npm run seed',
  'SEED_PASSWORD=password',
  '',
  '# Database khusus tes (npm test)',
  'DB_NAME_TEST=absensi_pkl_test',
].join('\r\n') + '\r\n';

fs.writeFileSync('.env', isi);
console.log('env dibuat, FACE_KEY dan JWT_SECRET acak OK');
