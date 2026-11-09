class HttpError extends Error {
  constructor(status, message, kode) {
    super(message);
    this.status = status;
    this.kode = kode;
  }
}
// Express 4 tidak menangkap error async sendiri
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, asyncH };
