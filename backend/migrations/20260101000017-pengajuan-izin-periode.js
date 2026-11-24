'use strict';

/** Pengajuan izin/sakit bisa mencakup periode (dari tanggal sampai tanggal).
 * tanggal_selesai menyimpan tanggal akhir; baris lama diisi sama dengan tanggal. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.addColumn('pengajuan_izin', 'tanggal_selesai', { type: T.DATEONLY, allowNull: true });
    await queryInterface.sequelize.query(
      'UPDATE pengajuan_izin SET tanggal_selesai = tanggal WHERE tanggal_selesai IS NULL',
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pengajuan_izin', 'tanggal_selesai');
  },
};
