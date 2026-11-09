'use strict';

/** Tantangan liveness: nonce hash sekali pakai + instruksi gerakan acak dari server.
 * Server tidak pernah menerima frame video; klien mengirim hasil pengukuran. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('tantangan_wajah', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false },
      nonce_hash: { type: T.CHAR(64), allowNull: false, unique: true },
      kode_gerakan: {
        type: T.ENUM('kedip', 'tengok_kiri', 'tengok_kanan', 'buka_mulut'),
        allowNull: false,
      },
      kedaluwarsa_pada: { type: T.DATE, allowNull: false },
      dipakai_pada: { type: T.DATE },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tantangan_wajah', ['user_id', 'dipakai_pada']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tantangan_wajah', ['user_id', 'dipakai_pada']);
    await queryInterface.dropTable('tantangan_wajah');
  },
};
