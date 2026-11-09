const { Op } = require('sequelize');
const env = require('../config/env');

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Tanggal dan jam menurut zona waktu aplikasi (bukan zona server atau perangkat)
function bagian(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: env.tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const tanggal = `${p.year}-${p.month}-${p.day}`;
  return {
    tanggal,
    jam: `${p.hour}:${p.minute}:${p.second}`,
    hari: HARI[new Date(`${tanggal}T00:00:00Z`).getUTCDay()],
    menit: Number(p.hour) * 60 + Number(p.minute),
  };
}

const menitDariJam = (j) => { const [h, m] = j.split(':'); return Number(h) * 60 + Number(m); };

// Terlambat jika absen masuk lewat (jam masuk + toleransi). Absen pulang selalu Hadir.
function hitungStatus(jenis, ws, w) {
  if (jenis !== 'masuk') return 'Hadir';
  return w.menit > menitDariJam(ws.jam_masuk) + ws.toleransi_menit ? 'Terlambat' : 'Hadir';
}

const tgl = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

// ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD -> kondisi Sequelize untuk kolom tanggal
function rentang(q) {
  const a = tgl(q.dari), b = tgl(q.sampai);
  if (a && b) return { [Op.between]: [a, b] };
  if (a) return { [Op.gte]: a };
  if (b) return { [Op.lte]: b };
  return null;
}

module.exports = { HARI, bagian, hitungStatus, rentang, menitDariJam };
