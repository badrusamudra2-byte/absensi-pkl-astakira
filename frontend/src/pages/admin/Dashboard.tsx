import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { RingkasanAdmin } from '../../lib/tipe';
import { Kartu, Pemberitahuan } from '../../komponen/ui';
import { tglPendek } from '../../komponen/umum';

function Angka({ nilai, label, warna }: { nilai: number | null; label: string; warna: string }) {
  return (
    <div className={`rounded-xl p-4 border border-garis bg-kartu flex-1 min-w-[140px] ${warna}`}>
      <p className="text-3xl font-extrabold">{nilai ?? '…'}</p>
      <p className="text-sm text-mu font-semibold mt-1">{label}</p>
    </div>
  );
}

/** Grafik batang sederhana (tanpa pustaka) untuk 7 hari terakhir. */
function Grafik({ data }: { data: RingkasanAdmin['grafik'] }) {
  const hari = [...new Set(data.map((g) => g.tanggal))].sort();
  if (!hari.length) return <p className="text-mu text-sm">Belum ada absensi 7 hari terakhir.</p>;
  const maks = Math.max(...data.map((g) => g.n), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-4 min-w-[420px] h-44" role="img" aria-label="Grafik kehadiran 7 hari terakhir">
        {hari.map((t) => {
          const hadir = data.find((g) => g.tanggal === t && g.status === 'Hadir')?.n ?? 0;
          const telat = data.find((g) => g.tanggal === t && g.status === 'Terlambat')?.n ?? 0;
          return (
            <div key={t} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <div className="flex items-end justify-center gap-1 w-full h-full">
                <div className="w-6 bg-g rounded-t" style={{ height: `${(hadir / maks) * 100}%` }} title={`Hadir: ${hadir}`} />
                <div className="w-6 bg-y rounded-t" style={{ height: `${(telat / maks) * 100}%` }} title={`Terlambat: ${telat}`} />
              </div>
              <small className="text-mu whitespace-nowrap">{tglPendek(t)}</small>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-mu mt-2">
        <span className="inline-block w-3 h-3 bg-g rounded-sm align-middle" /> Hadir{' '}
        <span className="inline-block w-3 h-3 bg-y rounded-sm align-middle ml-3" /> Terlambat
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [isi, ubahIsi] = useState<RingkasanAdmin | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  useEffect(() => {
    api<RingkasanAdmin>('/admin/ringkasan')
      .then(ubahIsi)
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  return (
    <>
      <Kartu t="Ringkasan hari ini">
        {galat ? (
          <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
        ) : (
          <div className="flex flex-wrap gap-3">
            <Angka nilai={isi?.peserta_aktif ?? null} label="Peserta aktif" warna="text-teks" />
            <Angka nilai={isi?.pembimbing_aktif ?? null} label="Pembimbing aktif" warna="text-teks" />
            <Angka nilai={isi?.hadir_hari_ini ?? null} label="Hadir hari ini" warna="text-g" />
            <Angka nilai={isi?.terlambat_hari_ini ?? null} label="Terlambat hari ini" warna="text-y" />
          </div>
        )}
      </Kartu>
      <Kartu t="Kehadiran 7 hari terakhir">
        {isi ? <Grafik data={isi.grafik} /> : <p className="text-mu text-sm">Memuat…</p>}
      </Kartu>
    </>
  );
}
