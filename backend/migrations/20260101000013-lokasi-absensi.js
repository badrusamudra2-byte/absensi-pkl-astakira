'use strict';

/** Tahap 1 lokasi absen: kolom koordinat di absensi dan qr_tokens,
 * serta pengaturan area kantor (Haversine divalidasi server).
 * Semua kolom lokasi boleh NULL — data absensi lama tidak tersentuh. */
const DT = require('sequelize').DataTypes;

const KOORDINAT = [
  ['lat', DT.DOUBLE],
  ['lng', DT.DOUBLE],
  ['akurasi_m', DT.DOUBLE],
];

module.exports = {
  async up(queryInterface) {
    // absensi: titik absen peserta + hasil validasi jarak server
    for (const [nama, jenis] of KOORDINAT) {
      await queryInterface.addColumn('absensi', nama, { type: jenis, allowNull: true, after: 'dikonfirmasi_oleh' });
    }
    await queryInterface.addColumn('absensi', 'jarak_m', { type: DT.DOUBLE, allowNull: true, after: 'akurasi_m' });
    await queryInterface.addColumn('absensi', 'di_dalam_area', { type: DT.BOOLEAN, allowNull: true, after: 'jarak_m' });

    // qr_tokens: lokasi peserta saat menayangkan QR (dipindai pembimbing kemudian;
    // posisi yang divalidasi tetap milik peserta, bukan HP pembimbing)
    for (const [nama, jenis] of KOORDINAT) {
      await queryInterface.addColumn('qr_tokens', nama, { type: jenis, allowNull: true, after: 'dipakai_pada' });
    }

    // pengaturan_absensi: area kantor. lat/lng NULL = validasi lokasi nonaktif.
    await queryInterface.addColumn('pengaturan_absensi', 'lat_kantor', { type: DT.DOUBLE, allowNull: true, after: 'liveness_aktif' });
    await queryInterface.addColumn('pengaturan_absensi', 'lng_kantor', { type: DT.DOUBLE, allowNull: true, after: 'lat_kantor' });
    await queryInterface.addColumn('pengaturan_absensi', 'radius_m', { type: DT.INTEGER, allowNull: false, defaultValue: 100, after: 'lng_kantor' });
    await queryInterface.addColumn('pengaturan_absensi', 'akurasi_maks_m', { type: DT.INTEGER, allowNull: false, defaultValue: 50, after: 'radius_m' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pengaturan_absensi', 'akurasi_maks_m');
    await queryInterface.removeColumn('pengaturan_absensi', 'radius_m');
    await queryInterface.removeColumn('pengaturan_absensi', 'lng_kantor');
    await queryInterface.removeColumn('pengaturan_absensi', 'lat_kantor');
    for (const [nama] of KOORDINAT) await queryInterface.removeColumn('qr_tokens', nama);
    await queryInterface.removeColumn('absensi', 'di_dalam_area');
    await queryInterface.removeColumn('absensi', 'jarak_m');
    for (const [nama] of KOORDINAT) await queryInterface.removeColumn('absensi', nama);
  },
};
