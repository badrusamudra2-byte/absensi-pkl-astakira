'use strict';

/** Foto wajah kini disimpan per momen absen: satu foto masuk dan satu foto pulang
 * pada baris absensi harian yang sama. Sebelumnya batas satu foto per absensi membuat
 * foto pulang menimpa foto masuk. */
const { DataTypes: T } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize;

    await queryInterface.addColumn('wajah_foto', 'jenis', {
      type: T.ENUM('masuk', 'pulang'),
      allowNull: true,
    });
    await db.query(`UPDATE wajah_foto SET jenis = 'masuk' WHERE jenis IS NULL`);
    await queryInterface.changeColumn('wajah_foto', 'jenis', {
      type: T.ENUM('masuk', 'pulang'),
      allowNull: false,
      defaultValue: 'masuk',
    });
    await queryInterface.removeIndex('wajah_foto', 'absensi_id');
    await queryInterface.addIndex('wajah_foto', {
      unique: true,
      name: 'uq_wajah_foto_absensi_jenis',
      fields: ['absensi_id', 'jenis'],
    });
  },

  async down(queryInterface) {
    const db = queryInterface.sequelize;

    await queryInterface.removeIndex('wajah_foto', 'uq_wajah_foto_absensi_jenis');
    await db.query(`DELETE FROM wajah_foto WHERE jenis = 'pulang'`);
    await queryInterface.removeColumn('wajah_foto', 'jenis');
    await queryInterface.addIndex('wajah_foto', {
      unique: true,
      name: 'absensi_id',
      fields: ['absensi_id'],
    });
  },
};
