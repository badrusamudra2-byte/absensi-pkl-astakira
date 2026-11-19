import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { BarisJurnalAbsensi, StatusJurnal } from '../../lib/tipe';
import { Kartu, Tabel, Tombol, Pemberitahuan, Badge, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
import { gunakanTerbaru } from '../../komponen/umum';

const STATUS_CARI: StatusJurnal[] = ['Draft', 'Dikirim', 'Revisi', 'Disetujui'];

export const labelStatus = (s: string) =>
  ({ Draft: 'Draft', Dikirim: 'Dikirim', Revisi: 'Perlu revisi', Disetujui: 'Disetujui' })[s] ?? s;

export default function JurnalList() {
  const [status, cuaStatus] = useState('');
  const [dari, cuDari] = useState('');
  const [sampai, cuSampai] = useState('');
  const [data, cuData] = useState<BarisJurnalAbsensi[] | null>(null);
  const [menmuat, cuMuat] = useState(true);
  const [galat, cuGalat] = useState<string | null>(null);
  const terbaru = gunakanTerbaru();

  const muat = useCallback(() => {
    const sah = terbaru();
    cuMuat(true);
    cuGalat(null);
    const cari = new URLSearchParams();
    if (status) cari.set('status', status);
    if (dari) cari.set('dari', dari);
    if (sampai) cari.set('sampai', sampai);
    const q = cari.toString();
    api<{ data: BarisJurnalAbsensi[] }>('/jurnal' + (q ? `?${q}` : ''))
      .then((r) => { if (sah(true)) cuData(r.data); })
      .catch(() => { if (sah(true)) cuGalat('Jurnal belum bisa dimuat. Pastikan server aktif lalu coba lagi.'); })
      .finally(() => { if (sah(true)) cuMuat(false); });
  }, [status, dari, sampai, terbaru]);

  useEffect(() => {
    muat();
  }, [muat]);

  const jumlah = (s: StatusJurnal) => (data ?? []).filter((j) => j.status === s).length;

  return (
    <>
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul="Jurnal Kegiatan"
        sub="Daftar jurnal harian Anda, mengikuti tanggal absensi masuk."
        aksi={
          <Link
            to="/jurnal/baru"
            className="inline-flex items-center gap-1.5 rounded-lg bg-pr text-white px-3.5 py-2 text-[11.5px] font-bold no-underline hover:brightness-110 transition"
          >
            <Ikon nama="plus" className="size-3.5" />
            Tulis jurnal
          </Link>
        }
      />

      <Kartu>
        <div className="grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="st" className="block text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">Status</label>
            <select
              id="st"
              value={status}
              onChange={(e) => cuaStatus(e.target.value)}
              className="w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
            >
              <option value="">Semua status</option>
              {STATUS_CARI.map((s) => (
                <option key={s} value={s}>{labelStatus(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dr" className="block text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">Dari</label>
            <input id="dr" type="date" value={dari} onChange={(e) => cuDari(e.target.value)}
              className="w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]" />
          </div>
          <div>
            <label htmlFor="sp" className="block text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">Sampai</label>
            <input id="sp" type="date" value={sampai} onChange={(e) => cuSampai(e.target.value)}
              className="w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]" />
          </div>
          <Tombol onClick={muat} disabled={menmuat} className="!h-[38px] w-full lg:w-auto">
            <Ikon nama="filter" className="size-3.5" />
            Tampilkan
          </Tombol>
        </div>
      </Kartu>

      {galat ? <Pemberitahuan jenis="warn" judul="Belum bisa dimuat" uraian={galat} /> : null}

      {!menmuat && data ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            ['Disetujui', 'bg-[#dcfce7] text-[#15803d]'],
            ['Dikirim', 'bg-[#dbeafe] text-[#1d4ed8]'],
            ['Revisi', 'bg-[#fef3c7] text-[#a16207]'],
            ['Draft', 'bg-[#f1f5f9] text-[#475569]'],
          ] as [StatusJurnal, string][]).map(([s, warna]) => (
            <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${warna}`}>
              {labelStatus(s)}
              <b>{jumlah(s)}</b>
            </span>
          ))}
        </div>
      ) : null}

      <Kartu t="Daftar jurnal">
        <p className="text-mu text-[11px] -mt-1 mb-3">
          Setiap tanggal absensi masuk muncul di sini. Tekan Buka atau Isi untuk menulis jurnal.
        </p>
        {menmuat ? (
          <div className="flex items-center gap-2 text-mu text-sm py-3">
            <Ikon nama="refresh" className="size-4 animate-spin" />
            Memuat…
          </div>
        ) : (
          <Tabel
            h={['Tanggal', 'Absensi', 'Judul', 'Status', 'Aksi']}
            rows={(data ?? []).map((j) => [
              <span key="t" className="whitespace-nowrap font-semibold">{j.tanggal}</span>,
              j.absensi ? (
                <span key="a" className="whitespace-nowrap">
                  <span className="text-g font-semibold">{j.absensi.masuk.slice(0, 5)}</span>{' '}
                  <Badge s={j.absensi.status} />
                </span>
              ) : <span key="a" className="text-mu">—</span>,
              j.judul
                ? <b key="j" className="font-semibold">{j.judul}</b>
                : <span key="j" className="text-mu">Belum diisi</span>,
              j.status ? <Badge key="s" s={j.status} /> : <span key="s" className="text-mu">—</span>,
              j.id ? (
                <Link key="d" to={`/jurnal/${j.id}`} className="inline-flex items-center gap-1 text-pr font-semibold no-underline" aria-label={`Buka jurnal ${j.tanggal}`}>
                  Buka
                  <Ikon nama="chevron" className="size-3" />
                </Link>
              ) : (
                <Link key="d" to={`/jurnal/baru?tanggal=${j.tanggal}`} className="inline-flex items-center gap-1 text-pr font-semibold no-underline" aria-label={`Isi jurnal untuk ${j.tanggal}`}>
                  Isi
                  <Ikon nama="edit" className="size-3" />
                </Link>
              ),
            ])}
            em="Belum ada tanggal absensi pada saringan ini. Absen masuk dulu, lalu jurnal tanggalnya akan muncul di sini."
          />
        )}
      </Kartu>
    </>
  );
}
