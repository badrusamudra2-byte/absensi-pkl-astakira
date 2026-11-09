'use strict';

/** Tabel profil: users, pembimbing, peserta, workshift — sesuai src/models/index.js. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('users', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      nama: { type: T.STRING(100), allowNull: false },
      username: { type: T.STRING(50), allowNull: false, unique: true },
      email: { type: T.STRING(120), allowNull: false, unique: true },
      password_hash: { type: T.STRING(100), allowNull: false },
      role: { type: T.ENUM('peserta', 'pembimbing', 'admin'), allowNull: false },
      foto_url: { type: T.STRING(255) },
      aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
      reset_token_hash: { type: T.CHAR(64) },
      reset_expires: { type: T.DATE },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });

    await queryInterface.createTable('pembimbing', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false, unique: true },
      divisi: { type: T.STRING(80) },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });

    await queryInterface.createTable('peserta', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false, unique: true },
      divisi: { type: T.STRING(80) },
      pembimbing_id: { type: T.INTEGER },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });

    await queryInterface.createTable('workshift', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      hari: { type: T.ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), allowNull: false, unique: true },
      hari_kerja: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
      jam_masuk: { type: T.TIME, allowNull: false },
      jam_pulang: { type: T.TIME, allowNull: false },
      toleransi_menit: { type: T.INTEGER, allowNull: false, defaultValue: 15 },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workshift');
    await queryInterface.dropTable('peserta');
    await queryInterface.dropTable('pembimbing');
    await queryInterface.dropTable('users');
  },
};
