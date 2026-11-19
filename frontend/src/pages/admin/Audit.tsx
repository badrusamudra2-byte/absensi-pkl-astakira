import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisAudit } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan } from '../../komponen/ui';
import { FxDaftar, gunakanTerbaru, waktuWib } from '../../komponen/umum';
import { Ikon } from '../../komponen/Ikon';

const LIMIT = 25;

const waktu = (iso: string) => waktuWib(iso); // UTC dari server dikonversi ke WIB

function DetailKoreksi({ detail }: { detail: string }) {
  let d: { lama?: Record<string, unknown>; baru?: Record<string, unknown>; alasan?: string };
  try {
    d = JSON.parse(detail);
  } catch {
    return <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#f8fafc] p-2.5 text-xs text-mu">{detail}</pre>;
  }
  if (!d.lama && !d.baru) return <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#f8fafc] p-2.5 text-xs text-mu">{detail}</pre>;
  const kolom = [...new Set([...Object.keys(d.lama ?? {}), ...Object.keys(d.baru ?? {})])];
  return (
    <div className="mt-2 max-w-[560px] overflow-x-auto rounded-lg border border-garis p-3">
      <p className="mb-2 text-sm"><b>Alasan:</b> {d.alasan || '-'}</p>
      <table className="border-collapse text-sm">
        <thead>
          <tr className="bg-[#f8fafc]">
            {['Kolom', 'Nilai lama', 'Nilai baru'].map((h) => (
              <th key={h} className="border-b border-garis px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-mu">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kolom.map((k) => (
            <tr key={k}>
              <td className="border-b border-garis/70 px-2 py-1.5 font-semibold">{k}</td>
              <td className="border-b border-garis/70 px-2 py-1.5 text-mu">{String(d.lama?.[k] ?? '-')}</td>
              <td className="border-b border-garis/70 px-2 py-1.5 font-semibold text-g">{String(d.baru?.[k] ?? '-')}</td>
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
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Audit log"
        sub="Jejak perubahan data penting, termasuk koreksi absensi."
        aksi={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-garis bg-kartu px-3 py-2 text-[11px] font-bold text-mu">
            <Ikon nama="activity" className="size-3.5 text-pr" />
            {total} catatan
          </span>
        }
      />

      <Kartu t="Riwayat aktivitas">
        {galat ? <div className="mb-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        <FxDaftar
          rows={rows}
          em="Belum ada catatan audit."
          kolom={[
            { t: 'Waktu', isi: (b) => <span className="whitespace-nowrap text-xs">{waktu(b.dibuat_pada)}</span> },
            { t: 'Pengguna', isi: (b) => <b>{b.pengguna}</b> },
            { t: 'Aksi', isi: (b) => <span className="text-sm">{b.aksi}</span> },
            { t: 'Target', isi: (b) => <span className="text-mu">{b.target || '-'}</span> },
            {
              t: 'Detail',
              isi: (b) =>
                b.detail ? (
                  <>
                    <button
                      onClick={() => ubahBuka(buka === b.id ? null : b.id)}
                      aria-expanded={buka === b.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2 py-1 text-[11px] font-bold text-pr transition hover:border-pr hover:bg-pl"
                    >
                      <Ikon nama="eye" className="size-3" />
                      {buka === b.id ? 'Tutup' : 'Lihat'}
                    </button>
                    {buka === b.id ? <DetailKoreksi detail={b.detail} /> : null}
                  </>
                ) : (
                  <span className="text-mu">-</span>
                ),
            },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-garis pt-4">
          <Tombol varian="gh" disabled={halaman <= 1} onClick={() => ubahHalaman((h) => Math.max(h - 1, 1))}>
            <Ikon nama="arrow" className="size-4 rotate-180" />
            Sebelumnya
          </Tombol>
          <span className="text-xs font-semibold text-mu">Halaman {halaman} / {halTotal}</span>
          <Tombol varian="gh" disabled={halaman >= halTotal} onClick={() => ubahHalaman((h) => h + 1)}>
            Berikutnya
            <Ikon nama="arrow" className="size-4" />
          </Tombol>
        </div>
      </Kartu>
    </>
  );
}
