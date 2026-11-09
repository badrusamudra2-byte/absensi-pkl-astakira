const c = require('crypto');
const env = require('../config/env');

// AES-256-GCM: format "iv.tag.ciphertext" (base64)
const potong = () => {
  const iv = c.randomBytes(12);
  const k = c.createCipheriv('aes-256-gcm', env.face.key, iv);
  return { iv, k };
};

const enc = (obj) => {
  const { iv, k } = potong();
  const ct = Buffer.concat([k.update(JSON.stringify(obj), 'utf8'), k.final()]);
  return [iv, k.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
};

const dec = (s) => {
  const [iv, tag, ct] = s.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = c.createDecipheriv('aes-256-gcm', env.face.key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString('utf8'));
};

// Bentuk sama (iv.tag.ct base64), tetapi payload mentah byte — untuk foto JPEG
const enkripBait = (buf) => {
  const { iv, k } = potong();
  const ct = Buffer.concat([k.update(buf), k.final()]);
  return [iv, k.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
};

const dekripBait = (s) => {
  const [iv, tag, ct] = s.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = c.createDecipheriv('aes-256-gcm', env.face.key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
};

const sha256 = (s) => c.createHash('sha256').update(s).digest('hex');
const acak = (n = 24) => c.randomBytes(n).toString('base64url');

module.exports = { enc, dec, enkripBait, dekripBait, sha256, acak };
