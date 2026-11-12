// Pabrik berkas laporan (CSV / Excel / PDF) — dipakai bersama oleh laporan admin
// dan rekap pembimbing agar format tidak berbeda-beda antar peran.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const csv = require('./csv');
const { bagian } = require('./waktu');

// '=' diawali kutip agar exceljs tidak menganggapnya rumus (mitigasi serupa dengan CSV).
const selXlsx = (v) => {
  const s = v == null ? '' : String(v);
  return s.startsWith('=') ? "'" + s : s;
};

// Nama berkas ikut rentang agar berkas yang terunduh tidak saling menimpa.
function namaBerkas(ext, dari, sampai) {
  const rentangTeks = dari || sampai ? `-${dari || 'awal'}_${sampai || dari || 'kini'}` : '';
  return `laporan-absensi${rentangTeks}.${ext}`;
}

// ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD yang sah (angka awal/akhir rentang untuk nama berkas & judul PDF).
function dariSampai(query) {
  const sah = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  return { dari: sah(query.dari), sampai: sah(query.sampai) };
}

/* ---------- Baris tiap bagian ---------- */
const barisRekap = (rekap) => rekap.map((k) => [
  k.nama, k.hadir, k.terlambat, k.izin, k.sakit, k.tidak_hadir,
  k.jurnal_disetujui, k.jurnal_dikirim, k.jurnal_revisi,
]);
const barisAbsensi = (absensi) => absensi.map((a) => [
  a.tanggal, a.peserta?.nama ?? '-', a.jenis, a.jam, a.status, a.metode,
]);
const barisJurnal = (jurnal) => jurnal.map((j) => [
  j.tanggal, j.peserta?.nama ?? '-', j.judul, j.status,
]);

/* ---------- CSV: satu berkas, tiga bagian berurutan (dengan baris judul) ---------- */
function csvLaporan({ rekap, absensi, jurnal }) {
  const bagianCsv = (judul, head, rows) => judul + '\r\n' + csv(head, rows).replace(/^\uFEFF/, '');
  return '\uFEFF' + [
    bagianCsv('REKAP PER PESERTA', ['Peserta', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir', 'Jurnal Disetujui', 'Jurnal Dikirim', 'Jurnal Revisi'], barisRekap(rekap)),
    bagianCsv('ABSENSI', ['Tanggal', 'Peserta', 'Jenis', 'Jam', 'Status', 'Metode'], barisAbsensi(absensi)),
    bagianCsv('JURNAL', ['Tanggal', 'Peserta', 'Judul', 'Status'], barisJurnal(jurnal)),
  ].join('\r\n\r\n');
}

/* ---------- Excel: tiga lembar ---------- */
async function xlsxLaporan({ rekap, absensi, jurnal }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Panel Absensi PKL Astakira Media';
  const tambah = (nama, head, rows) => {
    const ws = wb.addWorksheet(nama);
    ws.columns = head.map((h) => ({ header: h, width: Math.max(12, h.length + 4) }));
    rows.forEach((row) => ws.addRow(row.map(selXlsx)));
  };
  tambah('Rekap', ['Peserta', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir', 'Jurnal Disetujui', 'Jurnal Dikirim', 'Jurnal Revisi'], barisRekap(rekap));
  tambah('Absensi', ['Tanggal', 'Peserta', 'Jenis', 'Jam', 'Status', 'Metode'], barisAbsensi(absensi));
  tambah('Jurnal', ['Tanggal', 'Peserta', 'Judul', 'Status'], barisJurnal(jurnal));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- PDF: tiga tabel dengan pindah halaman otomatis ---------- */
function pdfLaporan({ rekap, absensi, jurnal, dari, sampai }) {
  return new Promise((selesai, gagal) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const potongan = [];
    doc.on('data', (c) => potongan.push(c));
    doc.on('end', () => selesai(Buffer.concat(potongan)));
    doc.on('error', gagal);

    doc.font('Helvetica-Bold').fontSize(15).text('Laporan Absensi PKL — Astakira Media');
    doc.font('Helvetica').fontSize(10).fillColor('#444444')
      .text(`Periode: ${dari || sampai ? `${dari || 'awal'} s.d. ${sampai || dari || 'kini'}` : 'Seluruh periode'} — dibuat ${bagian().tanggal} ${bagian().jam.slice(0, 5)} WIB`);
    doc.fillColor('#000000').moveDown(1);

    const tabel = (judul, kolom, rows) => {
      if (doc.y > doc.page.height - 120) { doc.addPage(); }
      doc.font('Helvetica-Bold').fontSize(12).text(judul).moveDown(0.4);
      const tinggiBaris = 16;
      const kepala = () => {
        const y = doc.y;
        kolom.forEach((k) => doc.font('Helvetica-Bold').fontSize(9).text(k.t, k.x, y, { width: k.w, lineBreak: false }));
        doc.moveDown(0.2).moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor('#999999').stroke();
        doc.y += 6;
      };
      kepala();
      rows.forEach((row) => {
        if (doc.y > doc.page.height - 60) { doc.addPage(); kepala(); }
        const y = doc.y;
        kolom.forEach((k, i) => doc.font('Helvetica').fontSize(9).text(String(row[i]), k.x, y, { width: k.w, lineBreak: false }));
        doc.y = y + tinggiBaris;
      });
      doc.moveDown(1);
    };

    const W = doc.page.width - 80;
    tabel('Rekap per peserta', [
      { t: 'Peserta', x: 40, w: W * 0.3 },
      { t: 'Hadir', x: 40 + W * 0.3, w: W * 0.09 },
      { t: 'Telat', x: 40 + W * 0.39, w: W * 0.09 },
      { t: 'Izin', x: 40 + W * 0.48, w: W * 0.09 },
      { t: 'Sakit', x: 40 + W * 0.57, w: W * 0.09 },
      { t: 'T.Absen', x: 40 + W * 0.66, w: W * 0.12 },
      { t: 'Jurnal (S/D/R)', x: 40 + W * 0.78, w: W * 0.22 },
    ], rekap.map((k) => [k.nama, k.hadir, k.terlambat, k.izin, k.sakit, k.tidak_hadir,
      `${k.jurnal_disetujui}/${k.jurnal_dikirim}/${k.jurnal_revisi}`]));
    tabel('Absensi', [
      { t: 'Tanggal', x: 40, w: W * 0.18 },
      { t: 'Peserta', x: 40 + W * 0.18, w: W * 0.27 },
      { t: 'Jenis', x: 40 + W * 0.45, w: W * 0.12 },
      { t: 'Jam', x: 40 + W * 0.57, w: W * 0.12 },
      { t: 'Status', x: 40 + W * 0.69, w: W * 0.17 },
      { t: 'Metode', x: 40 + W * 0.86, w: W * 0.14 },
    ], barisAbsensi(absensi));
    tabel('Jurnal', [
      { t: 'Tanggal', x: 40, w: W * 0.18 },
      { t: 'Peserta', x: 40 + W * 0.18, w: W * 0.27 },
      { t: 'Judul', x: 40 + W * 0.45, w: W * 0.38 },
      { t: 'Status', x: 40 + W * 0.83, w: W * 0.17 },
    ], barisJurnal(jurnal));

    doc.end();
  });
}

// Rekap per peserta dihitung dari baris yang sudah diambil (tanpa query agregat tambahan).
// rekap: [{ id, nama, ...nol }], absensi/jurnal: baris Sequelize dengan user_id + status.
function isiRekapDariBaris(rekap, absensi, jurnal) {
  const kAbs = { Hadir: 'hadir', Terlambat: 'terlambat', Izin: 'izin', Sakit: 'sakit', 'Tidak hadir': 'tidak_hadir' };
  const kJur = { Disetujui: 'jurnal_disetujui', Dikirim: 'jurnal_dikirim', Revisi: 'jurnal_revisi' };
  absensi.filter((a) => a.jenis === 'masuk').forEach((a) => {
    const k = rekap.find((r) => r.id === a.user_id);
    if (k && kAbs[a.status]) k[kAbs[a.status]] += 1;
  });
  jurnal.forEach((j) => {
    const k = rekap.find((r) => r.id === j.user_id);
    if (k && kJur[j.status]) k[kJur[j.status]] += 1;
  });
  return rekap;
}

const rekapKosong = (id, nama) => ({
  id, nama, hadir: 0, terlambat: 0, izin: 0, sakit: 0, tidak_hadir: 0,
  jurnal_disetujui: 0, jurnal_dikirim: 0, jurnal_revisi: 0,
});

module.exports = {
  namaBerkas, dariSampai, csvLaporan, xlsxLaporan, pdfLaporan,
  isiRekapDariBaris, rekapKosong,
};
