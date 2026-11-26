import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Workshift } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { Ikon } from '../../komponen/Ikon';

const URUT: Workshift['hari'][] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Kelola jadwal dan hari kerja (workshift) — dipakai perhitungan Hadir/Terlambat. */
export default function Jadwal() {
  const toast = useToast();
  const [rows, ubahRows] = useState<Workshift[] | null>(null);
  const hitungAsal = (r: Workshift[]) => JSON.stringify(URUT.map((h) => r.find((w) => w.hari === h) || null));
  const [asal, ubahAsal] = useState<string | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);

  useEffect(() => {
    api<{ data: Workshift[] }>('/workshift')
      .then((r) => {
        ubahRows(r.data);
        ubahAsal(hitungAsal(r.data));
      })
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  const ubah = (i: number, kolom: keyof Workshift, nilai: string | boolean | number) => {
    ubahRows((r) => (r ? r.map((w, n) => (n === i ? { ...w, [kolom]: nilai } : w)) : r));
  };

  const simpan = async () => {
    if (!rows) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string }>('/admin/workshift', {
        method: 'PUT',
        json: {
          items: rows.map((w) => ({
            hari: w.hari, hari_kerja: w.hari_kerja, jam_masuk: w.jam_masuk,
            jam_pulang: w.jam_pulang, toleransi_menit: w.toleransi_menit,
          })),
        },
      });
      toast(r.pesan);
      ubahAsal(hitungAsal(rows));
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedang(false);
    }
  };

  const kotor = asal !== null && JSON.stringify(URUT.map((h) => (rows ?? []).find((w) => w.hari === h) || null)) !== asal;

  return (
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Jadwal kerja"
        sub="Atur hari kerja, jam masuk/pulang, dan toleransi keterlambatan."
      />

      <div className="mb-4 flex items-start gap-3 rounded-kartu border border-[#c7dbff] bg-gradient-to-r from-[#eaf2ff] to-[#f5f9ff] p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-pr shadow-sm">
          <Ikon nama="calendar" className="size-4" />
        </span>
        <p className="text-[11.5px] leading-relaxed text-mu">
          Hari non-kerja otomatis menjadi hari libur (absensi ditolak dan penutup hari melewatinya).
          Datang sampai jam masuk + toleransi masih dihitung <b className="text-teks">Hadir</b>.
        </p>
      </div>

      <Kartu t="Jadwal dan hari kerja">
        {galat ? <div className="mb-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        {rows === null ? (
          <p className="flex items-center gap-2 py-3 text-sm text-mu">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-pr/25 border-t-pr" aria-hidden="true" />
            Memuat jadwal&hellip;
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    {['Hari', 'Hari kerja', 'Jam masuk', 'Jam pulang', 'Toleransi (menit)'].map((h) => (
                      <th key={h} className="border-b border-garis px-3 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[.45px] text-mu">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w, i) => {
                    const akhirPekan = w.hari === 'Sabtu' || w.hari === 'Minggu';
                    return (
                      <tr key={w.hari} className={akhirPekan ? 'bg-[#fbfcfe]' : ''}>
                        <td className="border-b border-garis/70 px-3 py-2.5 text-sm font-bold">
                          <span className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${w.hari_kerja ? 'bg-pr' : 'bg-garis'}`} aria-hidden="true" />
                            {w.hari}
                          </span>
                        </td>
                        <td className="border-b border-garis/70 px-3 py-2.5">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                            <input
                              type="checkbox"
                              checked={w.hari_kerja}
                              onChange={(e) => ubah(i, 'hari_kerja', e.target.checked)}
                              className="size-4 accent-pr"
                            />
                            kerja
                          </label>
                        </td>
                        <td className="border-b border-garis/70 px-3 py-2.5">
                          <input
                            type="time" step={60} value={w.jam_masuk.slice(0, 5)} disabled={!w.hari_kerja}
                            onChange={(e) => ubah(i, 'jam_masuk', e.target.value ? e.target.value + ':00' : '')}
                            className="h-9 rounded-lg border border-garis bg-kartu px-2 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10 disabled:cursor-not-allowed disabled:bg-[#f3f6fa] disabled:opacity-50"
                          />
                        </td>
                        <td className="border-b border-garis/70 px-3 py-2.5">
                          <input
                            type="time" step={60} value={w.jam_pulang.slice(0, 5)} disabled={!w.hari_kerja}
                            onChange={(e) => ubah(i, 'jam_pulang', e.target.value ? e.target.value + ':00' : '')}
                            className="h-9 rounded-lg border border-garis bg-kartu px-2 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10 disabled:cursor-not-allowed disabled:bg-[#f3f6fa] disabled:opacity-50"
                          />
                        </td>
                        <td className="border-b border-garis/70 px-3 py-2.5">
                          <input
                            type="number" min={0} max={120} value={w.toleransi_menit} disabled={!w.hari_kerja}
                            onChange={(e) => ubah(i, 'toleransi_menit', Number(e.target.value))}
                            className="h-9 w-24 rounded-lg border border-garis bg-kartu px-2 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10 disabled:cursor-not-allowed disabled:bg-[#f3f6fa] disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-garis pt-4">
              <Tombol onClick={() => void simpan()} disabled={sedang || !kotor}>
                <Ikon nama="check" className="size-4" />
                Simpan jadwal
              </Tombol>
              {kotor ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-y">
                  <span className="size-1.5 rounded-full bg-y" aria-hidden="true" />
                  Ada perubahan belum disimpan
                </span>
              ) : asal ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-mu">
                  <Ikon nama="checkCircle" className="size-3.5 text-g" />
                  Jadwal tersimpan
                </span>
              ) : null}
            </div>
          </>
        )}
      </Kartu>
    </>
  );
}
