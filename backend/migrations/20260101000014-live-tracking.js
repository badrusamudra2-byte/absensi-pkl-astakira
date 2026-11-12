'use strict';

/** Tahap 2 live tracking: sesi antara absen masuk dan absen pulang.
 * HANYA posisi terakhir disimpan (kolom di baris sesi, di-upsert kiriman berikut),
 * tanpa tabel jejak — baris posisi dihapus (NULL) saat sesi ditutup.
 * Persetujuan pertama peserta disimpan di users.setuju_live_tracking (NULL = belum). */
const DT = require('sequelize').DataTypes;

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('sesi_tracking', {
      id: { type: DT.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      user_id: { type: DT.INTEGER, allowNull: false },
      tanggal: { type: DT.DATEONLY, allowNull: false },
      status: { type: DT.ENUM('aktif', 'selesai'), allowNull: false, defaultValue: 'aktif' },
      mulai_pada: { type: DT.DATE, allowNull: false },
      ditutup_pada: { type: DT.DATE, allowNull: true },
      sebab: { type: DT.ENUM('pulang', 'otomatis'), allowNull: true },
      // Posisi terakhir perangkat peserta (di-upsert); NULL = belum ada kiriman
      lat: { type: DT.DOUBLE, allowNull: true },
      lng: { type: DT.DOUBLE, allowNull: true },
      akurasi_m: { type: DT.DOUBLE, allowNull: true },
      diperbarui_pada: { type: DT.DATE, allowNull: true },
    }, {
      indexes: [
        { fields: ['user_id', 'status'] },
        { fields: ['tanggal'] },
      ],
    });
    await queryInterface.addColumn('users', 'setuju_live_tracking', {
      type: DT.BOOLEAN, allowNull: true, after: 'aktif',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'setuju_live_tracking');
    await queryInterface.dropTable('sesi_tracking');
  },
};
