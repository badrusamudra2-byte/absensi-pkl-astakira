'use strict';

/** Tabel pengaturan absensi (baris tunggal id=1) dan waktu persetujuan wajah
 * pada face_templates. Metode absensi: qr_wajah (default), qr, wajah. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('pengaturan_absensi', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      metode: { type: T.ENUM('qr_wajah', 'qr', 'wajah'), allowNull: false, defaultValue: 'qr_wajah' },
      liveness_aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });

    await queryInterface.addColumn('face_templates', 'disetujui_pada', {
      type: T.DATE,
      allowNull: true,
      comment: 'Waktu peserta menyetujui penggunaan data wajah',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('face_templates', 'disetujui_pada');
    await queryInterface.dropTable('pengaturan_absensi');
  },
};
