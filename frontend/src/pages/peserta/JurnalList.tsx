import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { BarisJurnalAbsensi, StatusJurnal } from '../../lib/tipe';
import { Kartu, Tabel, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
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

  return (
    <>
      <Kartu t="Jurnal kegiatan saya">
        <div className="flex flex-wrap items-end gap-3">
          <p>
            <label htmlFor="st" className="block text-[13px] font-semibold mb-1">Status</label>
            <select
              id="st"
              value={status}
              onChange={(e) => cuaStatus(e.target.value)}
              className="px-[11px] py-2 border border-garis rounded-lg bg-bg"
            >
              <option value="">Semua status</option>
              {STATUS_CARI.map((s) => (
                <option key={s} value={s}>{labelStatus(s)}</option>
              ))}
            </select>
          </p>
          <p>
            <label htmlFor="dr" className="block text-[13px] font-semibold mb-1">Dari</label>
            <input id="dr" type="date" value={dari} onChange={(e) => cuDari(e.target.value)} className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
          </p>
          <p>
            <label htmlFor="sp" className="block text-[13px] font-semibold mb-1">Sampai</label>
            <input id="sp" type="date" value={sampai} onChange={(e) => cuSampai(e.target.value)} className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
          </p>
          <p>
            <Tombol onClick={muat} disabled={menmuat}>Tampilkan</Tombol>
          </p>
        </div>
      </Kartu>

      {galat ? <Pemberitahuan jenis="warn" judul="Belum bisa dimuat" uraian={galat} /> : null}
      <Kartu t="Daftar jurnal">
        <p className="text-mu text-sm mb-2">
          Daftar mengikuti absensi Anda: setiap tanggal yang Anda absen masuk muncul di sini.
          Tekan ikon pensil untuk mengisi jurnalnya.
        </p>
        {menmuat ? (
          <p className="text-mu text-sm">Memuat…</p>
        ) : (
          <Tabel
            h={['Tanggal', 'Absensi', 'Judul', 'Status', '']}
            rows={(data ?? []).map((j) => [
              j.tanggal,
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
                <Link key="d" to={`/jurnal/${j.id}`} className="text-pr underline no-underline" aria-label={`Buka jurnal ${j.tanggal}`}>
                  ✎ Buka
                </Link>
              ) : (
                <Link key="d" to={`/jurnal/baru?tanggal=${j.tanggal}`} className="text-pr underline no-underline" aria-label={`Isi jurnal untuk ${j.tanggal}`}>
                  ✎ Isi
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
