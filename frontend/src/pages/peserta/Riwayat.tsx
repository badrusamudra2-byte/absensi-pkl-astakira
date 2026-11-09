import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Absensi } from '../../lib/tipe';
import { Kartu, Tabel, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';

const isoHariIni = () => new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 10);
const bulanLalu = () => {
  const [y, m] = isoHariIni().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return { dari: d.toISOString().slice(0, 10), sampai: isoHariIni() };
};
const namaHari = (s: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${s}T12:00:00+07:00`));

export default function Riwayat() {
  const { dari: d0, sampai: s0 } = bulanLalu();
  const [dari, ubahDari] = useState(d0);
  const [sampai, ubahSampai] = useState(s0);
  const [data, ubahData] = useState<Absensi[] | null>(null);
  const [muat, ubahMuat] = useState(true);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  const muatUlang = useCallback(async () => {
    ubahMuat(true);
    ubahGalat(null);
    try {
      const r = await api<{ data: Absensi[] }>(`/absensi/riwayat?dari=${dari}&sampai=${sampai}`);
      ubahData(r.data);
    } catch (e) {
      const err = e as { status: number; kode: string; message: string };
      if (err.status === 400) {
        ubahGalat(['Rentang tanggal tidak valid.', 'Pilih rentang yang berurutan (dari lebih dulu dari sampai).']);
      } else {
        ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      }
    } finally {
      ubahMuat(false);
    }
  }, [dari, sampai]);

  useEffect(() => {
    void muatUlang();
  }, [muatUlang]);

  return (
    <>
      <Kartu t="Riwayat absensi saya">
        <div className="flex flex-wrap items-end gap-3">
          <p className="w-full">
            <label htmlFor="dari" className="block text-[13px] font-semibold mb-1">Dari</label>
            <input id="dari" type="date" value={dari} onChange={(e) => ubahDari(e.target.value)}
              className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
          </p>
          <p className="w-full">
            <label htmlFor="sampai" className="block text-[13px] font-semibold mb-1">Sampai</label>
            <input id="sampai" type="date" value={sampai} onChange={(e) => ubahSampai(e.target.value)}
              className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
          </p>
          <p>
            <Tombol onClick={() => void muatUlang()} disabled={muat}>Tampilkan</Tombol>
          </p>
        </div>
        {galat ? (
          <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div>
        ) : null}
      </Kartu>

      <Kartu t="Daftar absensi">
        {muat ? (
          <p className="text-mu text-sm">Memuat…</p>
        ) : (
          <Tabel
            h={['Tanggal', 'Jenis', 'Jam', 'Status', 'Metode']}
            rows={(data ?? []).map((a) => [
              `${namaHari(a.tanggal)}, ${a.tanggal}`,
              <b key="j" className="capitalize">{a.jenis}</b>,
              a.jam.slice(0, 5),
              <Badge key="s" s={a.status} />,
              a.metode,
            ])}
          />
        )}
      </Kartu>
    </>
  );
}
