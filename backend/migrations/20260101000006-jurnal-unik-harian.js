'use strict';

/** Satu jurnal per peserta per tanggal (batas keras di database). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('jurnal', {
      unique: true,
      name: 'uq_jurnal_harian',
      fields: ['user_id', 'tanggal'],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('jurnal', 'uq_jurnal_harian');
  },
};
