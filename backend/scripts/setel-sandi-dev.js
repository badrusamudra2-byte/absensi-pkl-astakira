// Alat sekali pakai (dev): atur ulang kata sandi satu akun ke nilai yang diberikan lewat env SANDI_BARU.
//   $env:SANDI_BARU='...'; node scripts/setel-sandi-dev.js <email>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');

const [email, sandi] = [process.argv[2], process.env.SANDI_BARU];
if (!email || !sandi) {
  console.error('Pemakaian: $env:SANDI_BARU="sandi"; node scripts/setel-sandi-dev.js <email>');
  process.exit(1);
}

(async () => {
  const u = await User.unscoped().findOne({ where: { email: email.trim().toLowerCase() } });
  if (!u) throw new Error('Akun tidak ditemukan: ' + email);
  await u.update({ password_hash: await bcrypt.hash(sandi, 12), reset_token_hash: null, reset_expires: null });
  console.log('Kata sandi akun berikut sudah disetel ulang:', u.email, '(' + u.role + ')');
  console.log('Anda bisa login sekarang. Sandi tidak dicetak ke log ini.');
  await require('../src/models').sequelize.close();
})().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
