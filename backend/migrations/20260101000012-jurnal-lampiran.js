'use strict';

/** Lampiran foto kegiatan jurnal (opsional): nama berkas di uploads/lampiran/. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.addColumn('jurnal', 'lampiran', { type: T.STRING(72), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jurnal', 'lampiran');
  },
};
