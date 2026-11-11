const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');
const jobs = require('./services/jobs');

(async () => {
  try {
    await sequelize.authenticate();
    // Skema database dibuat dan diubah lewat migrasi Sequelize (npm run db:migrate),
    // bukan sync() — lihat AGENTS.md. Bila tabel belum ada, jalankan migrasi dulu.
    app.listen(env.port, () => console.log(`API siap di http://localhost:${env.port}/api`));
    // Job rutin: penutup hari menandai peserta Tidak hadir setelah jam pulang + selisih
    jobs.mulai(5);
  } catch (e) {
    console.error('Gagal menjalankan server:', e.message);
    process.exit(1);
  }
})();
