import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisAudit } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan } from '../../komponen/ui';
import { FxDaftar, gunakanTerbaru, waktuWib } from '../../komponen/umum';

const LIMIT = 25;

const waktu = (iso: string) => waktuWib(iso); // UTC dari server dikonversi ke WIB

function DetailKoreksi({ detail }: { detail: string }) {
  let d: { lama?: Record<string, unknown>; baru?: Record<string, unknown>; alasan?: string };
  try {
    d = JSON.parse(detail);
  } catch {
    return <pre className="text-xs text-mu whitespace-pre-wrap">{detail}</pre>;
  }
  if (!d.lama && !d.baru) return <pre className="text-xs text-mu whitespace-pre-wrap">{detail}</pre>;
  const kolom = [...new Set([...Object.keys(d.lama ?? {}), ...Object.keys(d.baru ?? {})])];
  return (
    <div className="mt-2 border-2 border-garis rounded-lg p-3 max-w-[560px]">
      <p className="text-sm mb-2"><b>Alasan:</b> {d.alasan || '-'}</p>
      <table className="text-sm border-collapse">
        <thead>
          <tr>
            {['Kolom', 'Nilai lama', 'Nilai baru'].map((h) => (
              <th key={h} className="text-left text-xs text-mu px-2 py-1 border-b border-garis">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kolom.map((k) => (
            <tr key={k}>
              <td className="px-2 py-1 border-b border-garis font-semibold">{k}</td>
              <td className="px-2 py-1 border-b border-garis text-mu">{String(d.lama?.[k] ?? '-')}</td>
              <td className="px-2 py-1 border-b border-garis text-g font-semibold">{String(d.baru?.[k] ?? '-')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Audit() {
  const [rows, ubahRows] = useState<BarisAudit[] | null>(null);
  const [total, ubahTotal] = useState(0);
  const [halaman, ubahHalaman] = useState(1);
  const [buka, ubahBuka] = useState<number | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const terbaru = gunakanTerbaru();

  const muat = useCallback(async () => {
    const sah = terbaru();
    ubahRows(null);
    ubahGalat(null);
    try {
      const p = new URLSearchParams({ halaman: String(halaman), limit: String(LIMIT) });
      const r = await api<{ total: number; data: BarisAudit[] }>(`/admin/audit?${p}`);
      if (!sah(true)) return;
      ubahRows(r.data);
      ubahTotal(r.total);
    } catch (e) {
      if (!sah(true)) return;
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, [halaman, terbaru]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const halTotal = Math.max(Math.ceil(total / LIMIT), 1);

  return (
    <Kartu t="Audit log">
      <p className="mb-3 text-mu text-sm">total {total} catatan</p>
      {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
      <FxDaftar
        rows={rows}
        kolom={[
          { t: 'Waktu', isi: (b) => waktu(b.dibuat_pada) },
          { t: 'Pengguna', isi: (b) => b.pengguna },
          { t: 'Aksi', isi: (b) => <b>{b.aksi}</b> },
          { t: 'Target', isi: (b) => b.target || '-' },
          {
            t: 'Detail',
            isi: (b) =>
              b.detail ? (
                <>
                  <button
                    onClick={() => ubahBuka(buka === b.id ? null : b.id)}
                    aria-expanded={buka === b.id}
                    className="text-pr underline text-sm cursor-pointer bg-transparent border-0 p-0"
                  >
                    {buka === b.id ? 'Sembunyikan' : 'Lihat'}
                  </button>
                  {buka === b.id ? <DetailKoreksi detail={b.detail} /> : null}
                </>
              ) : (
                '-'
              ),
          },
        ]}
      />
      <p className="flex items-center gap-3 mt-4 text-sm">
        <Tombol varian="gh" disabled={halaman <= 1} onClick={() => ubahHalaman((h) => Math.max(h - 1, 1))}>Sebelumnya</Tombol>
        <span>halaman {halaman} / {halTotal}</span>
        <Tombol varian="gh" disabled={halaman >= halTotal} onClick={() => ubahHalaman((h) => h + 1)}>Berikutnya</Tombol>
      </p>
    </Kartu>
  );
}
