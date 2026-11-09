'use strict';

/** Tabel jurnal, review jurnal, dan audit log — sesuai src/models/index.js.
 * audit_log sengaja tanpa kolom updatedAt dan tanpa foreign key (lihat model). */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('jurnal', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false },
      tanggal: { type: T.DATEONLY, allowNull: false },
      judul: { type: T.STRING(150), allowNull: false },
      uraian: { type: T.TEXT, allowNull: false },
      hasil: { type: T.TEXT },
      kendala: { type: T.TEXT },
      rencana: { type: T.TEXT },
      status: { type: T.ENUM('Draft', 'Dikirim', 'Revisi', 'Disetujui'), allowNull: false, defaultValue: 'Draft' },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('jurnal', ['user_id', 'status']);

    await queryInterface.createTable('jurnal_review', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      jurnal_id: { type: T.INTEGER, allowNull: false },
      pembimbing_id: { type: T.INTEGER, allowNull: false },
      keputusan: { type: T.ENUM('Disetujui', 'Revisi'), allowNull: false },
      catatan: { type: T.TEXT },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });

    await queryInterface.createTable('audit_log', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER },
      aksi: { type: T.STRING(150), allowNull: false },
      target: { type: T.STRING(255) },
      ip: { type: T.STRING(64) },
      perangkat: { type: T.STRING(255) },
      dibuat_pada: { type: T.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_log');
    await queryInterface.dropTable('jurnal_review');
    await queryInterface.removeIndex('jurnal', ['user_id', 'status']);
    await queryInterface.dropTable('jurnal');
  },
};
