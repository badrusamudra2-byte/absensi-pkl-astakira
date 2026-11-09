import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { BarisJurnal, StatusJurnal } from '../../lib/tipe';
import { Kartu, Tabel, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';

const STATUS_CARI: StatusJurnal[] = ['Draft', 'Dikirim', 'Revisi', 'Disetujui'];

export const labelStatus = (s: string) =>
  ({ Draft: 'Draft', Dikirim: 'Dikirim', Revisi: 'Perlu revisi', Disetujui: 'Disetujui' })[s] ?? s;

export default function JurnalList() {
  const [status, cuaStatus] = useState('');
  const [dari, cuDari] = useState('');
  const [sampai, cuSampai] = useState('');
  const [data, cuData] = useState<BarisJurnal[] | null>(null);
  const [menmuat, cuMuat] = useState(true);
  const [galat, cuGalat] = useState<string | null>(null);

  const muat = useCallback(() => {
    cuMuat(true);
    cuGalat(null);
    const cari = new URLSearchParams();
    if (status) cari.set('status', status);
    if (dari) cari.set('dari', dari);
    if (sampai) cari.set('sampai', sampai);
    const q = cari.toString();
    api<{ data: BarisJurnal[] }>('/jurnal' + (q ? `?${q}` : ''))
      .then((r) => cuData(r.data))
      .catch(() => cuGalat('Jurnal belum bisa dimuat. Pastikan server aktif lalu coba lagi.'))
      .finally(() => cuMuat(false));
  }, [status, dari, sampai]);

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
        {menmuat ? (
          <p className="text-mu text-sm">Memuat…</p>
        ) : (
          <Tabel
            h={['Tanggal', 'Judul', 'Status', '']}
            rows={(data ?? []).map((j) => [
              j.tanggal,
              <b key="j" className="font-semibold">{j.judul}</b>,
              <Badge key="s" s={j.status} />,
              <Link key="d" to={`/jurnal/${j.id}`} className="text-pr underline no-underline">Buka</Link>,
            ])}
            em="Belum ada jurnal pada saringan ini. Tulis jurnal pertama Anda lewat tombol + Jurnal baru."
          />
        )}
      </Kartu>
      <Link to="/jurnal/baru" className="no-underline">
        <Tombol>+ Jurnal baru</Tombol>
      </Link>
    </>
  );
}
