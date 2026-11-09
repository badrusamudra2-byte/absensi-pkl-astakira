'use strict';

/** Pengajuan izin/sakit dari peserta beserta bukti foto (diunggah dari perangkatnya):
 * 'Menunggu' hingga pembimbing memutuskan; bila Disetujui, hari itu terekam Izin/Sakit. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('pengajuan_izin', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false },
      tanggal: { type: T.DATEONLY, allowNull: false },
      jenis: { type: T.ENUM('Izin', 'Sakit'), allowNull: false },
      status: { type: T.ENUM('Menunggu', 'Disetujui', 'Ditolak'), allowNull: false, defaultValue: 'Menunggu' },
      keterangan: { type: T.TEXT, allowNull: false },
      bukti: { type: T.STRING(72), allowNull: false },
      ditangani_oleh: { type: T.INTEGER, allowNull: true },
      catatan_putusan: { type: T.TEXT, allowNull: true },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('pengajuan_izin', ['user_id', 'tanggal'], { name: 'ix_pengajuan_pengguna' });
    await queryInterface.addIndex('pengajuan_izin', ['status', 'tanggal'], { name: 'ix_pengajuan_status' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('pengajuan_izin', 'ix_pengajuan_status');
    await queryInterface.removeIndex('pengajuan_izin', 'ix_pengajuan_pengguna');
    await queryInterface.dropTable('pengajuan_izin');
  },
};
