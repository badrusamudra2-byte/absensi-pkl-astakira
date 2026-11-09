import type { ReactNode } from 'react';

/** Format "2026-10-17" menjadi "Jumat, 17/10/2026". */
export const tglIndo = (s: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(`${s}T12:00:00+07:00`));

/** Format "2026-10-17" singkat "17/10". */
export const tglPendek = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7);

export const isoHariIni = () => new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 10);

export function FilterTanggal({
  dari, sampai, ubahDari, ubahSampai, aksi, sedang,
}: {
  dari: string; sampai: string;
  ubahDari: (v: string) => void; ubahSampai: (v: string) => void;
  aksi: () => void; sedang?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <p>
        <label htmlFor="f_dari" className="block text-[13px] font-semibold mb-1">Dari</label>
        <input id="f_dari" type="date" value={dari} onChange={(e) => ubahDari(e.target.value)}
          className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
      </p>
      <p>
        <label htmlFor="f_sampai" className="block text-[13px] font-semibold mb-1">Sampai</label>
        <input id="f_sampai" type="date" value={sampai} onChange={(e) => ubahSampai(e.target.value)}
          className="px-[11px] py-2 border border-garis rounded-lg bg-bg" />
      </p>
      <p>
        <button onClick={aksi} disabled={sedang}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border bg-pr border-pr text-pr-t cursor-pointer disabled:opacity-60">
          Tampilkan
        </button>
      </p>
    </div>
  );
}

type Kolom<T> = {
  t: string;
  /** Nilai utama (dijadikan judul kartu di HP). */
  utama?: (b: T) => ReactNode;
  isi: (b: T) => ReactNode;
};

/** Tabel di desktop; menjadi daftar kartu di layar sempit (< 640px). */
export function FxDaftar<T>({ kolom, rows, em = 'Tidak ada data pada rentang ini.' }: { kolom: Kolom<T>[]; rows: T[] | null; em?: string }) {
  if (rows === null) return <p className="text-mu text-sm">Memuat…</p>;
  if (!rows.length) return <p className="text-mu text-sm">{em}</p>;

  return (
    <>
      {/* Tabel desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse min-w-[520px]">
          <thead>
            <tr>
              {kolom.map((k) => (
                <th key={k.t} className="text-left text-xs text-mu font-semibold px-[10px] py-2 border-b border-garis">{k.t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={i}>
                {kolom.map((k, j) => (
                  <td key={j} className="px-[10px] py-[9px] border-b border-garis align-top text-sm">{k.isi(b)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Kartu HP */}
      <ul className="sm:hidden flex flex-col gap-3">
        {rows.map((b, i) => (
          <li key={i} className="border border-garis rounded-xl p-3">
            <p className="font-semibold text-sm mb-1">{kolom[0].isi(b)}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {kolom.slice(1).map((k) => (
                <div key={k.t} className="contents">
                  <dt className="text-mu text-xs pt-0.5">{k.t}</dt>
                  <dd>{k.isi(b)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
