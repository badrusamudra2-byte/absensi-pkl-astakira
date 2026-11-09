'use strict';

/** Tabel biometrik dan absensi — sesuai src/models/index.js. Tanpa foreign key keras
 * agar data historis tetap ada walau akun dihapus (pola yang sama dipakai model). */
module.exports = {
  async up(queryInterface, T) {
    await queryInterface.createTable('face_templates', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false, unique: true },
      embedding: {
        type: T.TEXT,
        allowNull: false,
        // Data biometrik; hanya disimpan terenkripsi AES-256-GCM (lihat src/utils/crypto.js).
        comment: 'Embedding wajah terenkripsi AES-256-GCM'
      },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });

    await queryInterface.createTable('face_verifications', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false },
      jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
      kedaluwarsa_pada: { type: T.DATE, allowNull: false },
      dipakai_pada: { type: T.DATE },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('face_verifications', ['user_id', 'jenis']);

    await queryInterface.createTable('qr_tokens', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      token_hash: { type: T.CHAR(64), allowNull: false, unique: true },
      user_id: { type: T.INTEGER, allowNull: false },
      jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
      kedaluwarsa_pada: { type: T.DATE, allowNull: false },
      dipindai_oleh: { type: T.INTEGER },
      dipindai_pada: { type: T.DATE },
      dipakai_pada: { type: T.DATE },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('qr_tokens', ['user_id', 'jenis']);

    await queryInterface.createTable('absensi', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false },
      tanggal: { type: T.DATEONLY, allowNull: false },
      jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
      jam: { type: T.TIME, allowNull: false },
      status: { type: T.ENUM('Hadir', 'Terlambat', 'Izin', 'Sakit'), allowNull: false },
      metode: { type: T.STRING(30), allowNull: false, defaultValue: 'QR+Wajah' },
      token_id: { type: T.INTEGER },
      dikonfirmasi_oleh: { type: T.INTEGER },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
    await queryInterface.addIndex('absensi', {
      unique: true,
      name: 'uq_absensi_harian',
      fields: ['user_id', 'tanggal', 'jenis'],
    });

    await queryInterface.createTable('absensi_penolakan', {
      id: { type: T.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: T.INTEGER, allowNull: false },
      token_id: { type: T.INTEGER, allowNull: false },
      pembimbing_id: { type: T.INTEGER, allowNull: false },
      alasan: { type: T.TEXT, allowNull: false },
      dibuat_pada: { type: T.DATE, allowNull: false },
      diubah_pada: { type: T.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('absensi_penolakan');
    await queryInterface.removeIndex('absensi', 'uq_absensi_harian');
    await queryInterface.dropTable('absensi');
    await queryInterface.removeIndex('qr_tokens', ['user_id', 'jenis']);
    await queryInterface.dropTable('qr_tokens');
    await queryInterface.removeIndex('face_verifications', ['user_id', 'jenis']);
    await queryInterface.dropTable('face_verifications');
    await queryInterface.dropTable('face_templates');
  },
};
