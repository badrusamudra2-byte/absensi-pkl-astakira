const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');
const jobs = require('./services/jobs');

(async () => {
  try {
    await sequelize.authenticate();
    // Tabel dibuat lewat migrasi (npm run db:migrate). DB_SYNC=true hanya untuk
    // development awal; jangan dipakai untuk perubahan skema (lihat AGENTS.md).
    if (env.dbSync) {
      console.warn('DB_SYNC=true: sequelize.sync() dijalankan (hanya untuk development awal).');
      await sequelize.sync();
    }
    app.listen(env.port, () => console.log(`API siap di http://localhost:${env.port}/api`));
    // Job rutin: penutup hari menandai peserta Tidak hadir setelah jam pulang + selisih
    jobs.mulai(5);
  } catch (e) {
    console.error('Gagal menjalankan server:', e.message);
    process.exit(1);
  }
})();
