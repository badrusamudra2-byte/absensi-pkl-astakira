const request = require('supertest');
const app = require('../src/app');
const { kosongkanDb, isiDasar, tokenUntuk } = require('./helper');
const M = require('../src/models');

const TGL = require('../src/utils/waktu').bagian().tanggal;
const geser = (n) => new Date(Date.parse(`${TGL}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const DARI = geser(7);
const SAMPAI = geser(1);
const TENGAH = geser(4); // tanggal lain di dalam rentang (jurnal unik per tanggal)
const DI_LUAR = geser(40); // jauh sebelum rentang uji

let dasar, tokAdmin, tokPmb, tokPsr;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();
  tokAdmin = await tokenUntuk('admin@astakira.id');
  tokPmb = await tokenUntuk('rizal@astakira.id');
  tokPsr = await tokenUntuk('alya@astakira.id');

  await M.Absensi.bulkCreate([
    { user_id: dasar.peserta.id, tanggal: DARI, jenis: 'masuk', jam: '08:05:00', status: 'Hadir', metode: 'QR+Wajah' },
    { user_id: dasar.peserta.id, tanggal: DARI, jenis: 'pulang', jam: '17:00:00', status: 'Hadir', metode: 'QR' },
    { user_id: dasar.peserta.id, tanggal: SAMPAI, jenis: 'masuk', jam: '09:40:00', status: 'Terlambat', metode: 'Wajah' },
    { user_id: dasar.peserta.id, tanggal: DI_LUAR, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR+Wajah' },
  ]);
  await M.Jurnal.bulkCreate([
    { user_id: dasar.peserta.id, tanggal: DARI, judul: 'Menyusun materi sosial media', uraian: '...', status: 'Disetujui' },
    { user_id: dasar.peserta.id, tanggal: SAMPAI, judul: 'Desain banner promosi', uraian: '...', status: 'Dikirim' },
    { user_id: dasar.peserta.id, tanggal: TENGAH, judul: 'Draft draf', uraian: '...', status: 'Draft' },
  ]);
});

const laporan = (token, q = '') => request(app).get(`/api/admin/laporan${q}`).set('Authorization', token);

// Respons biner (xlsx/pdf): supertest bawaan menyimpan sebagai teks — kumpulkan mentah.
const parserBiner = (res, cb) => {
  const potongan = [];
  res.on('data', (c) => potongan.push(c));
  res.on('end', () => cb(null, Buffer.concat(potongan)));
};
const laporanBiner = (token, q = '') => laporan(token, q).buffer(true).parse(parserBiner);

describe('Laporan admin (rekap + jurnal per periode)', () => {
  test('JSON: absensi, jurnal (tanpa Draft), dan rekap per peserta terisi benar', async () => {
    const r = await laporan(tokAdmin);
    expect(r.status).toBe(200);
    expect(r.body.absensi).toHaveLength(4);
    expect(r.body.jurnal.map((j) => j.judul)).not.toContain('Draft draf');
    expect(r.body.jurnal).toHaveLength(2);

    const rekap = r.body.rekap;
    expect(rekap).toHaveLength(1); // hanya peserta aktif (Dimas nonaktif tidak masuk)
    const alya = rekap.find((k) => k.nama === 'Alya Rahma');
    expect(alya).toMatchObject({ hadir: 2, terlambat: 1, izin: 0, sakit: 0, tidak_hadir: 0,
      jurnal_disetujui: 1, jurnal_dikirim: 1, jurnal_revisi: 0 });
  });

  test('filter rentang: baris di luar periode tidak ikut', async () => {
    const r = await laporan(tokAdmin, `?dari=${DARI}&sampai=${SAMPAI}`);
    expect(r.status).toBe(200);
    expect(r.body.absensi).toHaveLength(3);
    expect(r.body.absensi.every((a) => a.tanggal >= DARI && a.tanggal <= SAMPAI)).toBe(true);
  });

  test('filter user_id: hanya peserta itu (dan 400/404 untuk masukan salah)', async () => {
    const r = await laporan(tokAdmin, `?user_id=${dasar.peserta.id}`);
    expect(r.status).toBe(200);
    expect(r.body.absensi.every((a) => a.user_id === dasar.peserta.id)).toBe(true);

    const bukanAngka = await laporan(tokAdmin, '?user_id=abc');
    expect(bukanAngka.status).toBe(400);
    expect(bukanAngka.body.kode).toBe('VALIDASI');

    const bukanPeserta = await laporan(tokAdmin, `?user_id=${dasar.pembimbing.id}`);
    expect(bukanPeserta.status).toBe(404);
  });

  test('CSV: tipe, nama berkas berisi rentang, dan tiga bagian lengkap', async () => {
    const r = await laporan(tokAdmin, `?dari=${DARI}&sampai=${SAMPAI}&format=csv`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain(`laporan-absensi-${DARI}_${SAMPAI}.csv`);
    const baris = r.text.replace(/^\uFEFF/, '').split('\r\n');
    expect(baris[0]).toBe('REKAP PER PESERTA');
    expect(baris).toContain('Tanggal,Peserta,Jenis,Jam,Status,Metode');
    expect(baris).toContain('Tanggal,Peserta,Judul,Status');
    // Rekap berisi jurnal Disetujui/Dikirim milik peserta (dalam rentang: hadir 1, terlambat 1)
    expect(baris.some((b) => b.includes('Alya Rahma,1,1,0,0,0,1,1,0'))).toBe(true);
  });

  test('Excel: berkas xlsx sah (ditandai PK) dan audit tercatat', async () => {
    const r = await laporanBiner(tokAdmin, `?dari=${DARI}&sampai=${SAMPAI}&format=xlsx`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');
    expect(r.body.slice(0, 2).toString('latin1')).toBe('PK');
    const log = await M.AuditLog.findOne({ where: { aksi: 'Export laporan Excel' } });
    expect(log).toBeTruthy();
  });

  test('PDF: berkas pdf sah dan audit tercatat', async () => {
    const r = await laporanBiner(tokAdmin, `?dari=${DARI}&sampai=${SAMPAI}&format=pdf`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(r.body.slice(0, 5).toString('latin1')).toBe('%PDF-');
    const log = await M.AuditLog.findOne({ where: { aksi: 'Export laporan PDF' } });
    expect(log).toBeTruthy();
  });

  test('export dengan rentang hanya satu sisi tidak meleset', async () => {
    const r = await laporanBiner(tokAdmin, `?dari=${DARI}&format=xlsx`);
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toContain(`laporan-absensi-${DARI}_${DARI}.xlsx`);
    const p = await laporanBiner(tokAdmin, `?sampai=${SAMPAI}&format=pdf`);
    expect(p.status).toBe(200);
    expect(p.headers['content-disposition']).toContain(`laporan-absensi-awal_${SAMPAI}.pdf`);
  });

  test('pembimbing dan peserta tidak boleh mengakses laporan admin', async () => {
    expect((await laporan(tokPmb)).status).toBe(403);
    expect((await laporan(tokPsr)).status).toBe(403);
  });
});
