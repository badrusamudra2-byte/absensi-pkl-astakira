const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');

exports.auth = asyncH(async (req, res, next) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) throw new HttpError(401, 'Silakan login terlebih dahulu.', 'BELUM_LOGIN');
  let p;
  try {
    p = jwt.verify(t, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Sesi berakhir. Silakan login ulang.', 'SESI_HABIS');
  }
  // Cek ke database tiap request agar akun yang dinonaktifkan langsung tidak bisa dipakai
  const u = await User.findByPk(p.sub);
  if (!u || !u.aktif) throw new HttpError(401, 'Akun tidak aktif.', 'NONAKTIF');
  req.user = u;
  next();
});

exports.role = (...boleh) => (req, res, next) =>
  boleh.includes(req.user.role)
    ? next()
    : next(new HttpError(403, 'Anda tidak punya akses ke fitur ini.', 'DILARANG'));
