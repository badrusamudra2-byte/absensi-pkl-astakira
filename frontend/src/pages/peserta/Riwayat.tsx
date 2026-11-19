import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Absensi } from '../../lib/tipe';
import { Kartu, Tabel, Tombol, Pemberitahuan, Badge, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
import { gunakanTerbaru } from '../../komponen/umum';

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
  const terbaru = gunakanTerbaru();

  const muatUlang = useCallback(async () => {
    const sah = terbaru();
    ubahMuat(true);
    ubahGalat(null);
    try {
      const r = await api<{ data: Absensi[] }>(`/absensi/riwayat?dari=${dari}&sampai=${sampai}`);
      if (sah(true)) ubahData(r.data);
    } catch (e) {
      const err = e as { status: number; kode: string; message: string };
      if (!sah(true)) return; // respons basi: filter sudah berganti
      if (err.status === 400) {
        ubahGalat(['Rentang tanggal tidak valid.', 'Pilih rentang yang berurutan (dari lebih dulu dari sampai).']);
      } else {
        ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      }
    } finally {
      if (sah(true)) ubahMuat(false);
    }
  }, [dari, sampai, terbaru]);

  useEffect(() => {
    void muatUlang();
  }, [muatUlang]);

  return (
    <>
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul="Riwayat Absensi"
        sub="Rekap absensi masuk dan pulang Anda pada rentang tanggal tertentu."
      />

      <Kartu>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="dari" className="block text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">Dari</label>
            <input id="dari" type="date" value={dari} onChange={(e) => ubahDari(e.target.value)}
              className="w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]" />
          </div>
          <div>
            <label htmlFor="sampai" className="block text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">Sampai</label>
            <input id="sampai" type="date" value={sampai} onChange={(e) => ubahSampai(e.target.value)}
              className="w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]" />
          </div>
          <Tombol onClick={() => void muatUlang()} disabled={muat} className="!h-[38px] w-full sm:w-auto">
            <Ikon nama="filter" className="size-3.5" />
            {muat ? 'Memuat…' : 'Tampilkan'}
          </Tombol>
        </div>
        {galat ? (
          <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div>
        ) : null}
      </Kartu>

      <Kartu t="Daftar absensi">
        <p className="text-[11px] text-mu -mt-1 mb-3">
          {muat ? 'Memuat data…' : `${data?.length ?? 0} catatan pada rentang tanggal ini.`}
        </p>
        {muat ? (
          <div className="flex items-center gap-2 text-mu text-sm py-3">
            <Ikon nama="refresh" className="size-4 animate-spin" />
            Memuat…
          </div>
        ) : (
          <Tabel
            h={['Tanggal', 'Masuk', 'Pulang', 'Metode']}
            rows={(data ?? []).map((a) => [
              <span key="t" className="whitespace-nowrap">
                <b className="block font-semibold">{namaHari(a.tanggal)}</b>
                <small className="text-[10.5px] text-mu">{a.tanggal}</small>
              </span>,
              <span key="m"><b>{a.jam.slice(0, 5)}</b> <Badge s={a.status} /></span>,
              a.pulang_jam && a.pulang_status ? (
                <span key="p"><b>{a.pulang_jam.slice(0, 5)}</b> <Badge s={a.pulang_status} /></span>
              ) : <span key="p" className="text-mu">—</span>,
              a.metode,
            ])}
            em="Belum ada absensi pada rentang tanggal ini."
          />
        )}
      </Kartu>
    </>
  );
}
