'use strict';

/** Status Tidak hadir (job penutup hari), keterangan izin/sakit, dan detail audit koreksi. */
const EKSTATUS = "'Hadir','Terlambat','Izin','Sakit','Tidak hadir'";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE absensi MODIFY status ENUM(${EKSTATUS}) NOT NULL`,
    );
    await queryInterface.addColumn('absensi', 'keterangan', {
      type: require('sequelize').DataTypes.TEXT,
      allowNull: true,
      after: 'metode',
    });
    await queryInterface.addColumn('audit_log', 'detail', {
      type: require('sequelize').DataTypes.TEXT,
      allowNull: true,
      after: 'target',
    });
  },

  async down(queryInterface) {
    // Pindahkan baris Tidak hadir ke Izin agar enum lama tetap sah saat rollback
    await queryInterface.sequelize.query(
      "UPDATE absensi SET status = 'Izin' WHERE status = 'Tidak hadir'",
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE absensi MODIFY status ENUM('Hadir','Terlambat','Izin','Sakit') NOT NULL`,
    );
    await queryInterface.removeColumn('absensi', 'keterangan');
    await queryInterface.removeColumn('audit_log', 'detail');
  },
};
