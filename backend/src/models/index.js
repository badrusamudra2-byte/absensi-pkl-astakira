const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  nama: { type: T.STRING(100), allowNull: false },
  username: { type: T.STRING(50), allowNull: false, unique: true },
  email: { type: T.STRING(120), allowNull: false, unique: true },
  password_hash: { type: T.STRING(100), allowNull: false },
  role: { type: T.ENUM('peserta', 'pembimbing', 'admin'), allowNull: false },
  foto_url: T.STRING(255),
  aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  reset_token_hash: T.CHAR(64),
  reset_expires: T.DATE,
}, {
  tableName: 'users',
  // Kolom rahasia tidak ikut terambil kecuali memakai User.unscoped()
  defaultScope: { attributes: { exclude: ['password_hash', 'reset_token_hash', 'reset_expires'] } },
});

const Peserta = sequelize.define('Peserta', {
  user_id: { type: T.INTEGER, allowNull: false, unique: true },
  divisi: T.STRING(80),
  pembimbing_id: T.INTEGER, // id user dengan role pembimbing
}, { tableName: 'peserta' });

const Pembimbing = sequelize.define('Pembimbing', {
  user_id: { type: T.INTEGER, allowNull: false, unique: true },
  divisi: T.STRING(80),
}, { tableName: 'pembimbing' });

const Workshift = sequelize.define('Workshift', {
  hari: { type: T.ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), allowNull: false, unique: true },
  hari_kerja: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  jam_masuk: { type: T.TIME, allowNull: false },
  jam_pulang: { type: T.TIME, allowNull: false },
  toleransi_menit: { type: T.INTEGER, allowNull: false, defaultValue: 15 },
}, { tableName: 'workshift' });

const FaceTemplate = sequelize.define('FaceTemplate', {
  user_id: { type: T.INTEGER, allowNull: false, unique: true },
  embedding: { type: T.TEXT, allowNull: false }, // terenkripsi AES-256-GCM
  disetujui_pada: T.DATE, // waktu peserta menyetujui penggunaan data wajah
}, { tableName: 'face_templates' });

const FaceVerification = sequelize.define('FaceVerification', {
  user_id: { type: T.INTEGER, allowNull: false },
  jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipakai_pada: T.DATE,
}, { tableName: 'face_verifications', indexes: [{ fields: ['user_id', 'jenis'] }] });

const QrToken = sequelize.define('QrToken', {
  token_hash: { type: T.CHAR(64), allowNull: false, unique: true }, // hanya hash yang disimpan
  user_id: { type: T.INTEGER, allowNull: false },
  jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipindai_oleh: T.INTEGER,
  dipindai_pada: T.DATE,
  dipakai_pada: T.DATE,
}, { tableName: 'qr_tokens', indexes: [{ fields: ['user_id', 'jenis'] }] });

// QR yang ditayangkan pembimbing dan dipindai oleh peserta (diganti tiap QR_TTL_DETIK).
// Satu token = milik satu pembimbing; hash disimpan, token mentah hanya lewat respons.
const TokenPembimbing = sequelize.define('TokenPembimbing', {
  pembimbing_id: { type: T.INTEGER, allowNull: false },
  token_hash: { type: T.CHAR(64), allowNull: false, unique: true },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipakai_pada: T.DATE,
}, { tableName: 'token_pembimbing', indexes: [{ fields: ['pembimbing_id', 'dipakai_pada'] }] });

const Absensi = sequelize.define('Absensi', {
  user_id: { type: T.INTEGER, allowNull: false },
  tanggal: { type: T.DATEONLY, allowNull: false },
  jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
  jam: { type: T.TIME, allowNull: false },
  status: { type: T.ENUM('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'), allowNull: false },
  metode: { type: T.STRING(30), allowNull: false, defaultValue: 'QR+Wajah' },
  // Keterangan izin/sakit/koreksi; kosong untuk absensi biasa dan Tidak hadir otomatis
  keterangan: T.TEXT,
  token_id: T.INTEGER,
  dikonfirmasi_oleh: T.INTEGER,
}, {
  tableName: 'absensi',
  // Batas keras di database: satu jenis absen per peserta per hari
  indexes: [{ unique: true, name: 'uq_absensi_harian', fields: ['user_id', 'tanggal', 'jenis'] }],
});

const AbsensiPenolakan = sequelize.define('AbsensiPenolakan', {
  user_id: { type: T.INTEGER, allowNull: false },
  token_id: { type: T.INTEGER, allowNull: false },
  pembimbing_id: { type: T.INTEGER, allowNull: false },
  alasan: { type: T.TEXT, allowNull: false },
}, { tableName: 'absensi_penolakan' });

// Baris tunggal (id=1): metode absensi pengaturan penyelenggara.
const PengaturanAbsensi = sequelize.define('PengaturanAbsensi', {
  metode: { type: T.ENUM('qr_wajah', 'qr', 'wajah'), allowNull: false, defaultValue: 'qr_wajah' },
  liveness_aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'pengaturan_absensi' });

// Tantangan liveness: nonce hash sekali pakai + instruksi gerakan dari server.
const TantanganWajah = sequelize.define('TantanganWajah', {
  user_id: { type: T.INTEGER, allowNull: false },
  nonce_hash: { type: T.CHAR(64), allowNull: false, unique: true },
  kode_gerakan: { type: T.ENUM('kedip', 'tengok_kiri', 'tengok_kanan', 'buka_mulut'), allowNull: false },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipakai_pada: T.DATE,
}, { tableName: 'tantangan_wajah', indexes: [{ fields: ['user_id', 'dipakai_pada'] }] });

const Jurnal = sequelize.define('Jurnal', {
  user_id: { type: T.INTEGER, allowNull: false },
  tanggal: { type: T.DATEONLY, allowNull: false },
  judul: { type: T.STRING(150), allowNull: false },
  uraian: { type: T.TEXT, allowNull: false },
  hasil: T.TEXT,
  kendala: T.TEXT,
  rencana: T.TEXT,
  status: { type: T.ENUM('Draft', 'Dikirim', 'Revisi', 'Disetujui'), allowNull: false, defaultValue: 'Draft' },
}, {
  tableName: 'jurnal',
  indexes: [{ fields: ['user_id', 'status'] }, { unique: true, name: 'uq_jurnal_harian', fields: ['user_id', 'tanggal'] }],
});

const JurnalReview = sequelize.define('JurnalReview', {
  jurnal_id: { type: T.INTEGER, allowNull: false },
  pembimbing_id: { type: T.INTEGER, allowNull: false },
  keputusan: { type: T.ENUM('Disetujui', 'Revisi'), allowNull: false },
  catatan: T.TEXT,
}, { tableName: 'jurnal_review' });

// Sengaja tanpa foreign key agar log tetap ada walau akun dihapus
const AuditLog = sequelize.define('AuditLog', {
  user_id: T.INTEGER,
  aksi: { type: T.STRING(150), allowNull: false },
  target: T.STRING(255),
  // Detail terstruktur (mis. koreksi: {lama, baru, alasan})
  detail: T.TEXT,
  ip: T.STRING(64),
  perangkat: T.STRING(255),
}, { tableName: 'audit_log', updatedAt: false });

User.hasOne(Peserta, { foreignKey: 'user_id', as: 'peserta' });
Peserta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Peserta.belongsTo(User, { foreignKey: 'pembimbing_id', as: 'pembimbing' });
User.hasOne(Pembimbing, { foreignKey: 'user_id', as: 'pembimbing_profil' });
Pembimbing.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Absensi.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
QrToken.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
Jurnal.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
Jurnal.hasMany(JurnalReview, { foreignKey: 'jurnal_id', as: 'reviews' });
JurnalReview.belongsTo(User, { foreignKey: 'pembimbing_id', as: 'pembimbing' });

module.exports = {
  sequelize, User, Peserta, Pembimbing, Workshift, FaceTemplate, FaceVerification,
  QrToken, TokenPembimbing, Absensi, AbsensiPenolakan, Jurnal, JurnalReview, AuditLog,
  PengaturanAbsensi, TantanganWajah,
};
