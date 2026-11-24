describe('migrasi 16 — gabung baris pulang lama', () => {
  const migrasi = require('../migrations/20260101000016-change-unique-index');

  const buatQuery = (masuk) => {
    const query = jest.fn(async (sql) => {
      if (sql.includes("WHERE jenis = 'pulang'")) {
        return [{ id: 5, user_id: 9, tanggal: '2026-01-01', jam: '16:00:00', status: 'Hadir' }];
      }
      if (sql.includes('SELECT id FROM absensi')) return masuk;
      return [];
    });
    const queryInterface = {
      sequelize: { transaction: async (cb) => cb('TX'), query },
      removeIndex: jest.fn(),
      addIndex: jest.fn(),
    };
    return { query, queryInterface };
  };

  test('baris pulang dengan pasangan masuk digabung lalu dihapus', async () => {
    const { query, queryInterface } = buatQuery([{ id: 4 }]);
    await migrasi.up(queryInterface);

    const panggilan = query.mock.calls.map(([sql, opsi]) => ({ sql, opsi }));
    const gabung = panggilan.find((p) => p.sql.includes('SET pulang_jam'));
    const hapus = panggilan.find((p) => p.sql.includes('DELETE FROM absensi'));

    expect(gabung.opsi.replacements).toMatchObject({ id: 4, jam: '16:00:00', status: 'Hadir' });
    expect(hapus.opsi.replacements).toMatchObject({ id: 5 });
    expect(queryInterface.removeIndex).toHaveBeenCalledWith('absensi', 'uq_absensi_harian', { transaction: 'TX' });
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      'absensi',
      expect.objectContaining({ unique: true, fields: ['user_id', 'tanggal'], transaction: 'TX' }),
    );
  });

  test('baris pulang yatim diubah jadi baris masuk', async () => {
    const { query } = buatQuery([]);
    const queryInterface = {
      sequelize: { transaction: async (cb) => cb('TX'), query },
      removeIndex: jest.fn(),
      addIndex: jest.fn(),
    };
    await migrasi.up(queryInterface);

    const ubah = query.mock.calls
      .map(([sql, opsi]) => ({ sql, opsi }))
      .find((p) => p.sql.includes("SET jenis = 'masuk'"));
    expect(ubah.opsi.replacements).toMatchObject({ id: 5 });
  });
});
