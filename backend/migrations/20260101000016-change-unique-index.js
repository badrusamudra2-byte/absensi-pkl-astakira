'use strict';

/** Mengubah unique index: dari [user_id, tanggal, jenis] menjadi [user_id, tanggal].
 * Sebelum index diperketat, baris 'pulang' lama digabung ke baris 'masuk'
 * sehari yang sama. Tanpa langkah ini migrasi gagal dengan ER_DUP_ENTRY. */
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize;

    await db.transaction(async (t) => {
      const lama = await db.query(
        `SELECT id, user_id, tanggal, jam, status FROM absensi WHERE jenis = 'pulang' ORDER BY id`,
        { type: QueryTypes.SELECT, transaction: t },
      );

      for (const row of lama) {
        const masuk = await db.query(
          `SELECT id FROM absensi
           WHERE user_id = :user_id AND tanggal = :tanggal AND jenis = 'masuk' LIMIT 1`,
          { replacements: { user_id: row.user_id, tanggal: row.tanggal }, type: QueryTypes.SELECT, transaction: t },
        );
        const pasangan = masuk[0];

        if (pasangan) {
          await db.query(
            `UPDATE absensi
             SET pulang_jam = COALESCE(pulang_jam, :jam),
                 pulang_status = COALESCE(pulang_status, :status)
             WHERE id = :id`,
            { replacements: { jam: row.jam, status: row.status, id: pasangan.id }, transaction: t },
          );
          await db.query(`DELETE FROM absensi WHERE id = :id`, { replacements: { id: row.id }, transaction: t });
        } else {
          await db.query(
            `UPDATE absensi SET jenis = 'masuk' WHERE id = :id`,
            { replacements: { id: row.id }, transaction: t },
          );
        }
      }

      await queryInterface.removeIndex('absensi', 'uq_absensi_harian', { transaction: t });
      await queryInterface.addIndex('absensi', {
        unique: true,
        name: 'uq_absensi_harian',
        fields: ['user_id', 'tanggal'],
        transaction: t,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('absensi', 'uq_absensi_harian');
    await queryInterface.addIndex('absensi', {
      unique: true,
      name: 'uq_absensi_harian',
      fields: ['user_id', 'tanggal', 'jenis'],
    });
  },
};
