'use strict';

/** Tahap 2: Satukan absen masuk & pulang menjadi 1 baris per hari */
const DT = require('sequelize').DataTypes;

module.exports = {
  async up(queryInterface) {
    // Tambah kolom pulang ke tabel absensi untuk menyatukan data
    await queryInterface.addColumn('absensi', 'pulang_jam', { type: DT.TIME, allowNull: true, after: 'jam' });
    await queryInterface.addColumn('absensi', 'pulang_status', { type: DT.ENUM('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'), allowNull: true, after: 'pulang_jam' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('absensi', 'pulang_status');
    await queryInterface.removeColumn('absensi', 'pulang_jam');
  },
};