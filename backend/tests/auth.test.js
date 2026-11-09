const request = require('supertest');
jest.mock('../src/utils/mailer', () => ({ kirim: jest.fn().mockResolvedValue({}) }));
const app = require('../src/app');
const mail = require('../src/utils/mailer');
const { sha256 } = require('../src/utils/crypto');
const { kosongkanDb, isiDasar, SANDI_SEED } = require('./helper');

// Lima percobaan login + 1 lupa + 2 reset + 1 login = di bawah batas rate limit route.
beforeEach(kosongkanDb);
beforeEach(() => mail.kirim.mockClear());

describe('POST /api/auth/login', () => {
  test('berhasil untuk akun aktif (admin, pembimbing, peserta)', async () => {
    const { admin, pembimbing, peserta } = await isiDasar();
    for (const u of [admin, pembimbing, peserta]) {
      const r = await request(app).post('/api/auth/login').send({ identifier: u.email, password: SANDI_SEED });
      expect(r.status).toBe(200);
      expect(typeof r.body.token).toBe('string');
      expect(r.body.user).toMatchObject({ id: u.id, nama: u.nama, email: u.email, role: u.role });
    }
  });

  test('bisa login pakai username, bukan hanya email', async () => {
    await isiDasar();
    const r = await request(app).post('/api/auth/login').send({ identifier: 'alya', password: SANDI_SEED });
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('alya@astakira.id');
  });

  test('kata sandi salah -> 401 KREDENSIAL', async () => {
    await isiDasar();
    const r = await request(app).post('/api/auth/login').send({ identifier: 'alya@astakira.id', password: 'sandiangka' });
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ kode: 'KREDENSIAL' });
    expect(typeof r.body.pesan).toBe('string');
  });

  test('akun nonaktif -> 403 NONAKTIF', async () => {
    await isiDasar();
    const r = await request(app).post('/api/auth/login').send({ identifier: 'dimas@astakira.id', password: SANDI_SEED });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'NONAKTIF' });
  });
});

describe('lupa dan reset kata sandi', () => {
  test('lupa -> tautan berisi token -> reset -> login dengan sandi baru', async () => {
    const { peserta } = await isiDasar();

    const lupa = await request(app).post('/api/auth/lupa-password').send({ email: 'alya@astakira.id' });
    expect(lupa.status).toBe(200);
    expect(lupa.body.pesan).toContain('tautan');

    // Ambil tautan dari email yang (dimock) terkirim
    expect(mail.kirim).toHaveBeenCalledTimes(1);
    const teksEmail = mail.kirim.mock.calls[0][0].text;
    const token = teksEmail.match(/token=([A-Za-z0-9_-]+)/)[1];
    expect(token.length).toBeGreaterThan(10);

    const sandiBaru = 'sandi-baru-9a8b';
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: sandiBaru });
    expect(reset.status).toBe(200);
    expect(reset.body.pesan).toContain('Silakan login');

    const masuk = await request(app).post('/api/auth/login').send({ identifier: peserta.email, password: sandiBaru });
    expect(masuk.status).toBe(200);
    expect(masuk.body.user.id).toBe(peserta.id);

    // Sandi lama tidak lagi berlaku
    const lama = await request(app).post('/api/auth/login').send({ identifier: peserta.email, password: SANDI_SEED });
    expect(lama.status).toBe(401);
  });

  test('token reset yang salah -> 400 TOKEN_RESET', async () => {
    await isiDasar();
    const r = await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(32), password: 'sandi-pemulihan' });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ kode: 'TOKEN_RESET' });
  });

  test('lupa-password untuk email tak terdaftar tetap 200 (tidak membocorkan email)', async () => {
    await isiDasar();
    const r = await request(app).post('/api/auth/lupa-password').send({ email: 'tidak-ada@astakira.id' });
    expect(r.status).toBe(200);
    expect(mail.kirim).not.toHaveBeenCalled();
  });
});
