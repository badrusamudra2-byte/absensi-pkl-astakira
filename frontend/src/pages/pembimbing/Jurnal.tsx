import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisJurnalPembimbing, StatusJurnal } from '../../lib/tipe';
import { Kartu, JudulHalaman, Pemberitahuan, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';
import { Ikon } from '../../komponen/Ikon';

const STATUS: (StatusJurnal | 'Semua')[] = ['Semua', 'Dikirim', 'Revisi', 'Disetujui'];

export default function Jurnal() {
  const [status, ubahStatus] = useState<StatusJurnal | 'Semua'>('Semua');
  const [rows, ubahRows] = useState<BarisJurnalPembimbing[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  const muat = useCallback(async () => {
    ubahRows(null);
    ubahGalat(null);
    try {
      const q = status === 'Semua' ? '' : `?status=${status}`;
      const r = await api<{ data: BarisJurnalPembimbing[] }>(`/pembimbing/jurnal${q}`);
      ubahRows(r.data);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, [status]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <>
      <JudulHalaman
        eyebrow="Pembimbing"
        judul="Review jurnal"
        sub="Tinjau jurnal kegiatan peserta, lalu setujui atau minta revisi."
      />

      <Kartu t="Daftar jurnal">
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS.map((s) => (
            <label
              key={s}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                status === s
                  ? 'border-pr bg-pr text-white shadow-sm'
                  : 'border-garis bg-kartu text-mu hover:border-pr/50 hover:text-pr'
              }`}
            >
              <input type="radio" name="st_jurnal" className="sr-only" checked={status === s} onChange={() => ubahStatus(s)} />
              {s === 'Dikirim' ? 'Perlu review' : s}
              {status === s && rows ? (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{rows.length}</span>
              ) : null}
            </label>
          ))}
        </div>

        {galat ? <div className="mb-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}

        <FxDaftar
          rows={rows}
          em="Belum ada jurnal pada filter ini."
          kolom={[
            { t: 'Tanggal', isi: (b) => <span className="whitespace-nowrap font-semibold">{b.tanggal}</span> },
            { t: 'Peserta', isi: (b) => b.peserta?.nama ?? '-' },
            {
              t: 'Judul',
              isi: (b) => (
                <Link to={`/pembimbing/jurnal/${b.id}`} className="font-semibold text-pr no-underline hover:underline">
                  {b.judul}
                </Link>
              ),
            },
            { t: 'Status', isi: (b) => <Badge s={b.status} /> },
            {
              t: 'Aksi',
              isi: (b) => (
                <Link
                  to={`/pembimbing/jurnal/${b.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2.5 py-1.5 text-xs font-bold text-pr no-underline transition hover:border-pr hover:bg-pl"
                >
                  {b.status === 'Dikirim' ? 'Review' : 'Lihat'}
                  <Ikon nama="arrow" className="size-3.5" />
                </Link>
              ),
            },
          ]}
        />
      </Kartu>
    </>
  );
}
