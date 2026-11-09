const request = require('supertest');
const app = require('../src/app');
const { kosongkanDb, isiDasar, tokenUntuk } = require('./helper');

beforeEach(kosongkanDb);

describe('penjaga peran dan sesi', () => {
  test('tanpa token -> 401 BELUM_LOGIN', async () => {
    const r = await request(app).get('/api/admin/ringkasan');
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ kode: 'BELUM_LOGIN' });
  });

  test('token kadaluarsa -> 401 SESI_HABIS', async () => {
    const env = require('../src/config/env');
    const jwt = require('jsonwebtoken');
    await isiDasar();
    const tokenKedaluwarsa = jwt.sign({ sub: 1, role: 'peserta' }, env.jwtSecret, { expiresIn: '0s' });
    await new Promise((r) => setTimeout(r, 1100)); // pastikan benar-benar kadaluarsa
    const r = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + tokenKedaluwarsa);
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ kode: 'SESI_HABIS' });
  });

  test('peserta memanggil endpoint admin -> 403 DILARANG', async () => {
    await isiDasar();
    const authz = await tokenUntuk('alya@astakira.id');
    const r = await request(app).get('/api/admin/ringkasan').set('Authorization', authz);
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
  });

  test('pembimbing juga dilarang di endpoint admin', async () => {
    await isiDasar();
    const authz = await tokenUntuk('rizal@astakira.id');
    const r = await request(app).get('/api/admin/peserta').set('Authorization', authz);
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ kode: 'DILARANG' });
  });

  test('admin sah boleh ke endpoint admin dan /auth/me membawa profil', async () => {
    await isiDasar();
    const authz = await tokenUntuk('admin@astakira.id');
    const r = await request(app).get('/api/admin/ringkasan').set('Authorization', authz);
    expect(r.status).toBe(200);
  });

  test('peserta melihat profil pembimbingnya melalui /auth/me', async () => {
    await isiDasar();
    const M = require('../src/models');
    const pmb = await M.Pembimbing.findOne();
    const psr = await M.Peserta.unscoped().findOne();
    await psr.update({ pembimbing_id: pmb.user_id });

    const authz = await tokenUntuk('alya@astakira.id');
    const r = await request(app).get('/api/auth/me').set('Authorization', authz);
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('peserta');
    expect(r.body.profil.pembimbing.nama).toBe('Rizal Hakim');
  });
});
