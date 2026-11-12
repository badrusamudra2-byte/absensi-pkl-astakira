'use strict';

/** Mengubah unique index: dari [user_id, tanggal, jenis] menjadi [user_id, tanggal] */
const DT = require('sequelize').DataTypes;

module.exports = {
  async up(queryInterface) {
    // Hapus index lama yang menyertakan 'jenis'
    await queryInterface.removeIndex('absensi', 'uq_absensi_harian');
    // Tambah index baru tanpa 'jenis' biar satu baris per user per tanggal
    await queryInterface.addIndex('absensi', {
      unique: true,
      name: 'uq_absensi_harian',
      fields: ['user_id', 'tanggal'],
    });
  },

  async down(queryInterface) {
    // Kembali ke index lama kalau perlu
    await queryInterface.removeIndex('absensi', 'uq_absensi_harian');
    await queryInterface.addIndex('absensi', {
      unique: true,
      name: 'uq_absensi_harian',
      fields: ['user_id', 'tanggal', 'jenis'],
    });
  },
};