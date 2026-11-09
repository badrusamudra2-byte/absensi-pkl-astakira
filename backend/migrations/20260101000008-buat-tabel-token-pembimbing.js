'use strict';

/** Tabel token tayang QR pembimbing — dipindai peserta langsung dari HP-nya.
 * Pengganti arah; tabel alur lama (qr_tokens) tetap ada untuk data historis. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('token_pembimbing', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      pembimbing_id: { type: T.INTEGER, allowNull: false },
      token_hash: {
        type: T.CHAR(64),
        allowNull: false,
        unique: true,
        comment: 'SHA-256 token tayang; token mentah tidak pernah disimpan'
      },
      kedaluwarsa_pada: { type: T.DATE, allowNull: false },
      dipakai_pada: { type: T.DATE },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('token_pembimbing', ['pembimbing_id', 'dipakai_pada']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('token_pembimbing', ['pembimbing_id', 'dipakai_pada']);
    await queryInterface.dropTable('token_pembimbing');
  },
};
