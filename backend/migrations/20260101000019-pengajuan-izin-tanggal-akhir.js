'use strict';

/** Rentang pengajuan izin/sakit: tanggal_akhir berisi hari terakhir (inklusif).
 * NULL berarti pengajuan satu hari (data lama tidak perlu diubah). */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.addColumn('pengajuan_izin', 'tanggal_akhir', { type: T.DATEONLY, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pengajuan_izin', 'tanggal_akhir');
  },
};
