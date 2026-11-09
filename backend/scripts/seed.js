require('../src/config/env');
const bcrypt = require('bcryptjs');
const M = require('../src/models');

(async () => {
  const pw = process.env.SEED_PASSWORD;
  if (!pw || pw.length < 8) {
    console.error('Isi SEED_PASSWORD (minimal 8 karakter) di .env sebelum menjalankan seed.');
    process.exit(1);
  }
  // Tabel dibuat lewat npm run db:migrate; seed hanya mengisi data awal.
  await M.sequelize.authenticate();
  const hash = await bcrypt.hash(pw, 12);

  const buatUser = async (nama, email, role, aktif = true) => {
    const [u] = await M.User.findOrCreate({
      where: { email },
      defaults: { nama, email, username: email.split('@')[0], role, password_hash: hash, aktif },
    });
    return u;
  };

  await buatUser('Admin Astakira', 'admin@astakira.id', 'admin');

  const pembimbing = {};
  for (const [nama, email, divisi] of [
    ['Mahesa Prakoso', 'mahesa@astakira.id', 'Desain Grafis'],
    ['Rahardi Wibowo', 'rahardi@astakira.id', 'Konten Kreatif'],
  ]) {
    const u = await buatUser(nama, email, 'pembimbing');
    await M.Pembimbing.findOrCreate({ where: { user_id: u.id }, defaults: { divisi } });
    pembimbing[nama] = u;
  }

  for (const [nama, email, divisi, pb, aktif] of [
    ['Samudra Wijaya', 'samudra@astakira.id', 'Desain Grafis', 'Mahesa Prakoso', true],
    ['Bima Pratama', 'bima@astakira.id', 'Videografi', 'Rahardi Wibowo', true],
    ['Aldi Ramadhan', 'aldi@astakira.id', 'Desain Grafis', 'Mahesa Prakoso', true],
    ['Dimas Saputra', 'dimas@astakira.id', 'Sosial Media', 'Rahardi Wibowo', false],
  ]) {
    const u = await buatUser(nama, email, 'peserta', aktif);
    await M.Peserta.findOrCreate({ where: { user_id: u.id }, defaults: { divisi, pembimbing_id: pembimbing[pb].id } });
  }

  const kerja = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  for (const hari of ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']) {
    await M.Workshift.findOrCreate({
      where: { hari },
      defaults: {
        hari_kerja: kerja.includes(hari),
        jam_masuk: '08:00:00',
        jam_pulang: hari === 'Jumat' ? '15:30:00' : '16:00:00',
        toleransi_menit: 15,
      },
    });
  }
  console.log('Seed selesai. Login dengan email di atas dan kata sandi dari SEED_PASSWORD.');
  await M.sequelize.close();
})().catch((e) => { console.error(e); process.exit(1); });
