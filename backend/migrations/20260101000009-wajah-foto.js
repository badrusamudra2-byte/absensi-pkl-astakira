'use strict';

/** Foto wajah peserta pada momen absensi (diambil HP siswa saat verifikasi, terenkripsi
 * AES-256-GCM): tersambung ke tabel wajah_foto berpasangan satu-satu dengan absensi, dan
 * face_verifications menerima foto sementara menunggu dipakai absensi. */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('wajah_foto', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      absensi_id: { type: T.INTEGER, allowNull: false, unique: true },
      data: { type: T.TEXT('medium'), allowNull: false }, // "iv.tag.ct" base64 JPEG terenkripsi
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addColumn('face_verifications', 'foto_ciphertext', {
      type: T.TEXT('medium'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('face_verifications', 'foto_ciphertext');
    await queryInterface.dropTable('wajah_foto');
  },
};
