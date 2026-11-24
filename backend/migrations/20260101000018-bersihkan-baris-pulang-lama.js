'use strict';

/** Normalisasi pasangan pulang_jam/pulang_status pada baris absensi harian.
 * Penggabungan baris lama jenis='pulang' sudah dilakukan migrasi 16 sebelum
 * index unik diperketat, jadi migrasi ini hanya membersihkan data. */

module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize;

    await db.transaction(async (t) => {
      await db.query(
        `UPDATE absensi
         SET pulang_status = 'Hadir'
         WHERE pulang_jam IS NOT NULL AND pulang_status IS NULL`,
        { transaction: t },
      );
      await db.query(
        `UPDATE absensi
         SET pulang_status = NULL
         WHERE pulang_jam IS NULL AND pulang_status IS NOT NULL`,
        { transaction: t },
      );
    });
  },

  async down() {},
};
