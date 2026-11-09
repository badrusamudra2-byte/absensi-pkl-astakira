const { Sequelize } = require('sequelize');
const env = require('./env');

module.exports = new Sequelize(env.db.name, env.db.user, env.db.pass, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  timezone: '+00:00', // simpan waktu dalam UTC; tampilan mengikuti TZ_APLIKASI
  logging: false,
  define: { timestamps: true, createdAt: 'dibuat_pada', updatedAt: 'diubah_pada' },
  pool: { max: 10, idle: 10000 },
});
