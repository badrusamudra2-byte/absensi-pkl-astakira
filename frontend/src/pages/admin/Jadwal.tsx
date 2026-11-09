import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Workshift } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';

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
    <Kartu t="Jadwal dan hari kerja">
      <p className="text-mu text-sm mb-3 max-w-[620px]">
        Hari non-kerja otomatis menjadi hari libur (absensi ditolak dan penutup hari melewatinya).
        Toleransi menit: datang sampai jam masuk + toleransi masih dihitung Hadir.
      </p>
      {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
      {rows === null ? (
        <p className="text-mu text-sm">Memuat…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  {['Hari', 'Hari kerja', 'Jam masuk', 'Jam pulang', 'Toleransi (menit)'].map((h) => (
                    <th key={h} className="text-left text-xs text-mu font-semibold px-[10px] py-2 border-b border-garis">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((w, i) => (
                  <tr key={w.hari}>
                    <td className="px-[10px] py-2 border-b border-garis font-semibold text-sm">{w.hari}</td>
                    <td className="px-[10px] py-2 border-b border-garis">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={w.hari_kerja} onChange={(e) => ubah(i, 'hari_kerja', e.target.checked)} />
                        kerja
                      </label>
                    </td>
                    <td className="px-[10px] py-2 border-b border-garis">
                      <input type="time" step={60} value={w.jam_masuk.slice(0, 5)} disabled={!w.hari_kerja}
                        onChange={(e) => ubah(i, 'jam_masuk', e.target.value + ':00')}
                        className="px-2 py-1 border border-garis rounded-lg bg-bg disabled:opacity-50" />
                    </td>
                    <td className="px-[10px] py-2 border-b border-garis">
                      <input type="time" step={60} value={w.jam_pulang.slice(0, 5)} disabled={!w.hari_kerja}
                        onChange={(e) => ubah(i, 'jam_pulang', e.target.value + ':00')}
                        className="px-2 py-1 border border-garis rounded-lg bg-bg disabled:opacity-50" />
                    </td>
                    <td className="px-[10px] py-2 border-b border-garis">
                      <input type="number" min={0} max={120} value={w.toleransi_menit} disabled={!w.hari_kerja}
                        onChange={(e) => ubah(i, 'toleransi_menit', Number(e.target.value))}
                        className="w-20 px-2 py-1 border border-garis rounded-lg bg-bg disabled:opacity-50" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            <Tombol onClick={() => void simpan()} disabled={sedang || !kotor}>Simpan jadwal</Tombol>
          </p>
        </>
      )}
    </Kartu>
  );
}
