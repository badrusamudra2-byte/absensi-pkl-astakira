'use strict';

/** Rapikan sisa desain lama: tabel token_pembimbing tidak pernah dipakai kode apa pun
 * (alur QR yang dibangun memakai tabel qr_tokens). Turunkan dengan aman. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('token_pembimbing');
  },

  async down(queryInterface, T) {
    await queryInterface.createTable('token_pembimbing', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      pembimbing_id: { type: T.INTEGER, allowNull: false },
      token_hash: {
        type: T.CHAR(64),
        allowNull: false,
        unique: true,
        comment: 'SHA-256 token tayang; token mentah tidak pernah disimpan'
      },
    });
  },
};
