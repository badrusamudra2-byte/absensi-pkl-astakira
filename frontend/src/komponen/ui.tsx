import type { ReactNode } from 'react';

export function Kartu({ t, children, className = '' }: { t?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-kartu border border-garis rounded-xl p-4 md:p-[18px] mb-4 ${className}`}>
      {t ? <h2 className="text-base font-bold mb-3">{t}</h2> : null}
      {children}
    </section>
  );
}

type TombolVarian = 'utama' | 'gh' | 'dg' | 'dg2';
export function Tombol({
  varian = 'utama',
  children,
  className = '',
  ...rest
}: { varian?: TombolVarian } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const dasar = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border cursor-pointer transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed';
  const warna =
    varian === 'utama'
      ? 'bg-pr border-pr text-pr-t'
      : varian === 'gh'
        ? 'bg-transparent text-pr border-garis'
        : varian === 'dg'
          ? 'bg-transparent text-r border-garis'
          : 'bg-r border-r text-white';
  return (
    <button className={`${dasar} ${warna} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Galat({ pesan }: { pesan: string | null }) {
  if (!pesan) return null;
  return (
    <p className="text-r text-sm font-semibold" role="alert" aria-live="polite">
      {pesan}
    </p>
  );
}

export function Label({ children, ...rest }: { children: ReactNode } & React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="block text-[13px] font-semibold mt-3" {...rest}>
      {children}
    </label>
  );
}

export function Masukan(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg text-teks font-normal"
      {...props}
    />
  );
}

/** Peringatan blok di dalam kartu (info biru / peringatan kuning / galat merah). */
export function Pemberitahuan({ jenis = 'info', judul, uraian, aksi }: { jenis?: 'info' | 'warn' | 'er'; judul: string; uraian?: string; aksi?: ReactNode }) {
  const warna =
    jenis === 'er'
      ? 'border-r bg-[#b91c1c10] text-r'
      : jenis === 'warn'
        ? 'border-y bg-[#a1620716] text-y'
        : 'border-pr bg-pl text-pr';
  return (
    <div className={`rounded-lg border px-[14px] py-3 my-2 max-w-[460px] ${warna}`} role="alert" aria-live="polite">
      <b className="block mb-0.5">{judul}</b>
      {uraian ? <p className="text-sm">{uraian}</p> : null}
      {aksi}
    </div>
  );
}

export function Badge({ s }: { s: string }) {
  const warna: Record<string, string> = {
    Hadir: 'text-g bg-[#15803d20]',
    Terlambat: 'text-y bg-[#a1620724]',
    Izin: 'text-pr bg-pl',
    Sakit: 'text-o bg-[#c2410c20]',
    Diterima: 'text-g bg-[#15803d20]',
    Ditolak: 'text-r bg-[#b91c1c20]',
    Menunggu: 'text-s bg-[#47556920]',
    Diperiksa: 'text-pr bg-pl',
  };
  return (
    <span className={`inline-block px-[10px] py-0.5 rounded-full font-semibold text-xs whitespace-nowrap ${warna[s] ?? warna.Menunggu}`}>
      {s}
    </span>
  );
}

export function Tabel({ h, rows, em = 'Tidak ada data pada rentang ini.' }: { h: string[]; rows: ReactNode[][]; em?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[520px]">
        <thead>
          <tr>
            {h.map((x) => (
              <th key={x} className="text-left text-xs text-mu font-semibold px-[10px] py-2 border-b border-garis">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((c, i) => (
              <tr key={i}>
                {c.map((x, j) => (
                  <td key={j} className="px-[10px] py-[9px] border-b border-garis align-top text-sm">
                    {x}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={h.length} className="px-[10px] py-3 text-mu text-sm">
                {em}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
