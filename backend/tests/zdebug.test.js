process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'absensi_pkl_test';
process.env.DB_SYNC = 'false';
const M = require('../src/models');
const { kosongkanDb, buatUser } = require('./helper');
const request = require('supertest');
const app = require('../src/app');

afterAll(async () => { await M.sequelize.close(); });

const dump = async (tanda) => {
  const [rows] = await M.sequelize.query('SELECT id, username, aktif FROM users ORDER BY id');
  console.log(tanda, JSON.stringify(rows));
};

test('debug', async () => {
  console.log('DB_NAME =', process.env.DB_NAME);
  await dump('AWAL            :');
  await kosongkanDb();
  await dump('SETELAH TRUNCATE:');
  const pw = process.env.SEED_PASSWORD || 'password';
  await new Promise((r) => setTimeout(r, 3000));
  await dump('SETELAH 3 DETIK :');
  await buatUser({ nama: 'Dbg', username: 'dbg', email: 'dbg@astakira.id', role: 'admin' });
  await dump('SETELAH INSERT  :');
  const r = await request(app).post('/api/auth/login').send({ identifier: 'dbg@astakira.id', password: pw });
  console.log('login:', r.status);
}, 25000);
