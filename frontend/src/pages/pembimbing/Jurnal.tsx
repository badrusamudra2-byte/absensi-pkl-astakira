import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisJurnalPembimbing, StatusJurnal } from '../../lib/tipe';
import { Kartu, Pemberitahuan, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';

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
    <Kartu t="Jurnal peserta bimbingan">
      <p className="mb-3 flex flex-wrap gap-2">
        {STATUS.map((s) => (
          <label key={s} className={`cursor-pointer rounded-full border border-garis px-3 py-1 text-sm font-semibold ${status === s ? 'bg-pr text-pr-t border-pr' : 'bg-kartu'}`}>
            <input type="radio" name="st_jurnal" className="sr-only" checked={status === s} onChange={() => ubahStatus(s)} />
            {s === 'Dikirim' ? 'Perlu review' : s}
          </label>
        ))}
      </p>
      {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
      <FxDaftar
        rows={rows}
        kolom={[
          { t: 'Tanggal', isi: (b) => b.tanggal },
          { t: 'Peserta', isi: (b) => b.peserta?.nama ?? '-' },
          {
            t: 'Judul',
            isi: (b) => (
              <Link to={`/pembimbing/jurnal/${b.id}`} className="text-pr underline">
                {b.judul}
              </Link>
            ),
          },
          { t: 'Status', isi: (b) => <Badge s={b.status} /> },
        ]}
      />
    </Kartu>
  );
}
