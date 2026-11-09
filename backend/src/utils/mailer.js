const nodemailer = require('nodemailer');
const env = require('../config/env');

const transport = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true }); // development: tidak mengirim, hanya mencetak

exports.kirim = async ({ to, subject, text }) => {
  const r = await transport.sendMail({ from: env.smtp.from, to, subject, text });
  // Isi pesan (sandi sementara / tautan reset) TIDAK ditulis ke log — mode development
  // hanya mencatat penerima dan subjek. Untuk melihat isi saat dev, set SMTP_HOST (Mailtrap dsb.).
  if (!env.smtp.host) console.log(`[email development] terkirim ke ${to} — ${subject}`);
  return r;
};
