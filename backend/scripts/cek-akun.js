require('dotenv').config();
const p = require('mysql2/promise');
(async () => {
  const c = await p.createConnection({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASS,
  });
  try {
    const [u] = await c.query(
      `SELECT us.email, us.nama, us.role, us.aktif,
              (SELECT divisi FROM absensi_pkl.pembimbing pb WHERE pb.user_id = us.id) divisi_pmb,
              (SELECT divisi FROM absensi_pkl.peserta ps WHERE ps.user_id = us.id) divisi_psr,
              (SELECT us2.email FROM absensi_pkl.peserta ps JOIN absensi_pkl.users us2 ON us2.id = ps.pembimbing_id WHERE ps.user_id = us.id) pembimbing_email
       FROM absensi_pkl.users us ORDER BY us.role, us.nama`,
    );
    for (const r of u) console.log(`${r.role.padEnd(10)} ${r.email.padEnd(22)} ${r.aktif ? 'AKTIF    ' : 'nonaktif '} pb=${r.pembimbing_email ?? '-'}`);
  } finally { await c.end(); }
})().catch((x) => { console.log('GAGAL:', x.message); process.exit(0); });
