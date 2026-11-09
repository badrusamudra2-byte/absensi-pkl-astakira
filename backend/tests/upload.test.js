const request = require('supertest');
const app = require('../src/app');
const { kosongkanDb, isiDasar, buatUser, tokenUntuk, SANDI_SEED } = require('./helper');
const fs = require('fs');
const path = require('path');

let tok;

beforeEach(async () => {
  await kosongkanDb();
  await isiDasar();
  tok = await tokenUntuk('rizal@astakira.id');
  // Bersihkan isi folder foto, jangan hapus foldernya (dibuat saat modul upload termuat)
  const fotoDir = path.join(__dirname, '../uploads/foto');
  if (fs.existsSync(fotoDir)) for (const f of fs.readdirSync(fotoDir)) fs.rmSync(path.join(fotoDir, f), { force: true });
});

const unggah = (buffer, nama, mime) =>
  request(app)
    .post('/api/profil/foto')
    .set('Authorization', tok)
    .attach('foto', buffer, { filename: nama, contentType: mime });

describe('Unggah foto profil (validasi isi, bukan hanya MIME)', () => {
  // PNG sah 1x1
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  // JPEG sah (FF D8 FF ... FFD9)
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

  test('PNG asli diterima dan tersimpan dengan ekstensi yang benar', async () => {
    const r = await unggah(png, 'botol.png', 'image/png');
    expect(r.status).toBe(200);
    expect(r.body.foto_url).toMatch(/^\/uploads\/foto\/[a-f0-9]{32}\.png$/);
    expect(fs.existsSync(path.join(__dirname, '../', r.body.foto_url.slice(1)))).toBe(true);
  });

  test('JPEG diterima', async () => {
    const r = await unggah(jpg, 'botol.jpg', 'image/jpeg');
    expect(r.status).toBe(200);
    expect(r.body.foto_url.endsWith('.jpg')).toBe(true);
  });

  test('Klaim image/png tetapi isi HTML/PDF ditolak (400 UPLOAD)', async () => {
    const ISIAN = '<html><b>skrip tersembunyi</b></html>';
    const r = await unggah(Buffer.from(ISIAN), 'palsu.png', 'image/png');
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('UPLOAD');
    expect(r.body.pesan).toMatch(/bukan gambar/i);
  });

  test('Klaim image/jpeg tetapi isi PNG mismatch ekstensi ditolak', async () => {
    // Isi sah PNG tapi klaim image/jpeg -> ditolak karena tanda isi JPEG tidak cocok
    const r = await unggah(png, 'silang.jpg', 'image/jpeg');
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('UPLOAD');
  });

  test('MIME non-gambar ditolak', async () => {
    const r = await unggah(Buffer.from('whatever'), 'botol.pdf', 'application/pdf');
    expect(r.status).toBe(400);
    expect(r.body.kode).toBe('UPLOAD');
  });

  test('tanpa berkas -> 400 VALIDASI; tanpa login -> 401', async () => {
    const kosong = await request(app).post('/api/profil/foto').set('Authorization', tok);
    expect(kosong.status).toBe(400);
    expect(kosong.body.kode).toBe('VALIDASI');
    const nol = await request(app).post('/api/profil/foto').attach('foto', png, { filename: 'x.png', contentType: 'image/png' });
    expect(nol.status).toBe(401);
  });

  test('akun nonaktif tidak bisa login untuk mengunggah (403 NONAKTIF)', async () => {
    await buatUser({ nama: 'Dimas', username: 'dimz', email: 'dimz@astakira.id', role: 'peserta', aktif: false });
    const r = await request(app).post('/api/auth/login').send({ identifier: 'dimz@astakira.id', password: SANDI_SEED });
    expect(r.status).toBe(403);
    expect(r.body.kode).toBe('NONAKTIF');
  });
});
