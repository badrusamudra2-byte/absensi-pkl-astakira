const request = require('supertest');
const app = require('../src/app');
const { kosongkanDb, isiDasar, tokenUntuk, buatUser } = require('./helper');
const M = require('../src/models');

const TGL = require('../src/utils/waktu').bagian().tanggal;
const geser = (n) => new Date(Date.parse(`${TGL}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const DARI = geser(7);
const SAMPAI = geser(1);

// parserBiner/laporanBiner: supertest bawaan menyimpan xlsx/pdf sebagai teks — kumpulkan mentah.
const parserBiner = (res, cb) => {
  const potongan = [];
  res.on('data', (c) => potongan.push(c));
  res.on('end', () => cb(null, Buffer.concat(potongan)));
};

let dasar, tokAdmin, tokPmb, tokPsr, pesertaLuar;

beforeEach(async () => {
  await kosongkanDb();
  dasar = await isiDasar();
  tokAdmin = await tokenUntuk('admin@astakira.id');
  tokPmb = await tokenUntuk('rizal@astakira.id');
  tokPsr = await tokenUntuk('alya@astakira.id');

  // Peserta milik pembimbing lain — tidak boleh ikut laporan bimbingan Rizal
  const pmbLain = await buatUser({ nama: 'Pembimbing Lain', username: 'pmblain', email: 'lain@astakira.id', role: 'pembimbing' });
  pesertaLuar = await buatUser({ nama: 'Zaki Luar', username: 'zaki', email: 'zaki@astakira.id', role: 'peserta' });
  await M.Peserta.create({ user_id: pesertaLuar.id, pembimbing_id: pmbLain.id });

  await M.Absensi.bulkCreate([
    { user_id: dasar.peserta.id, tanggal: DARI, jenis: 'masuk', jam: '08:05:00', status: 'Hadir', metode: 'QR+Wajah' },
    { user_id: dasar.peserta.id, tanggal: SAMPAI, jenis: 'masuk', jam: '09:40:00', status: 'Terlambat', metode: 'Wajah' },
    { user_id: pesertaLuar.id, tanggal: DARI, jenis: 'masuk', jam: '08:00:00', status: 'Hadir', metode: 'QR' },
  ]);
  await M.Jurnal.create({
    user_id: dasar.peserta.id, tanggal: DARI, judul: 'Menyusun materi sosial media', uraian: '...', status: 'Dikirim',
  });
});

const rekapPmb = (token, q = '') =>
  request(app).get(`/api/pembimbing/rekap${q}`).set('Authorization', token);

const rekapBiner = (token, q = '') => rekapPmb(token, q).buffer(true).parse(parserBiner);

describe('Ekspor laporan pembimbing (rekap bimbingan)', () => {
  test('CSV: tiga bagian, hanya peserta bimbingan, rekap terisi', async () => {
    const r = await rekapPmb(tokPmb, `?dari=${DARI}&sampai=${SAMPAI}&format=csv`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text).toContain('REKAP PER PESERTA');
    expect(r.text).toContain('ABSENSI');
    expect(r.text).toContain('JURNAL');
    const baris = r.text.replace(/^\uFEFF/, '').split('\r\n');
    // Bimbingan ada di rekap; peserta pembimbing lain tidak boleh ikut
    expect(r.text).toContain('Alya Rahma');
    expect(baris.some((b) => b.includes('Alya Rahma,1,1,0,0,0,0,1,0'))).toBe(true);
    expect(r.text).not.toContain('Zaki Luar');
  });

  test('Excel dan PDF: berkas sah', async () => {
    const x = await rekapBiner(tokPmb, `?dari=${DARI}&sampai=${SAMPAI}&format=xlsx`);
    expect(x.status).toBe(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    expect(x.body.slice(0, 2).toString('latin1')).toBe('PK');

    const p = await rekapBiner(tokPmb, `?dari=${DARI}&sampai=${SAMPAI}&format=pdf`);
    expect(p.status).toBe(200);
    expect(p.headers['content-type']).toContain('application/pdf');
    expect(p.body.slice(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('JSON tanpa format tidak berubah (tidak ada rekap)', async () => {
    const r = await rekapPmb(tokPmb, `?dari=${DARI}&sampai=${SAMPAI}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body)).toEqual(['absensi', 'jurnal']);
    expect(r.body.absensi).toHaveLength(2); // punya bimbingan saja
  });

  test('audit tercatat', async () => {
    await rekapPmb(tokPmb, `?dari=${DARI}&sampai=${SAMPAI}&format=xlsx`);
    const log = await M.AuditLog.findOne({ where: { aksi: 'Export laporan Excel' } });
    expect(log).toBeTruthy();
  });

  test('admin dan peserta tidak boleh ekspor rekap pembimbing', async () => {
    expect((await rekapPmb(tokAdmin, '?format=csv')).status).toBe(403);
    expect((await rekapPmb(tokPsr, '?format=csv')).status).toBe(403);
  });
});
