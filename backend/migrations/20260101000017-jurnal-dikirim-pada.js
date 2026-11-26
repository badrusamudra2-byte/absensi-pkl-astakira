'use strict';

/** Waktu jurnal benar-benar dikirim ke pembimbing.
 * Dipisah dari diubah_pada karena diubah_pada ikut berubah saat review,
 * sehingga garis waktu bisa menampilkan jam kirim yang salah. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.addColumn('jurnal', 'dikirim_pada', { type: T.DATE, allowNull: true });
    // Baris lama berstatus Dikirim belum pernah direview, jadi diubah_pada
    // pada baris tersebut memang waktu pengiriman.
    await queryInterface.sequelize.query(
      "UPDATE jurnal SET dikirim_pada = diubah_pada WHERE status = 'Dikirim' AND dikirim_pada IS NULL",
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jurnal', 'dikirim_pada');
  },
};
