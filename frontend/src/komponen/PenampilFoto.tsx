import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/** Ekstensi berkas mengikuti jenis isi blob, bukan tebalan klien. */
const ekstensi = (jenis: string): string => {
  if (jenis.includes('png')) return '.png';
  if (jenis.includes('webp')) return '.webp';
  return '.jpg';
};

/** Modal penampil lampiran foto: foto tampil di dalam aplikasi (overlay gelap),
 * bukan di tab baru — tidak rentan kena blokir pop-up. Bisa diunduh dari modal
 * (unduhan lewat blob, karena API memakai token di header). Tutup dengan tombol,
 * tombol Esc, atau klik latar. Fokus awal ke tombol Tutup. */
export function PenampilFoto({
  buka, judul, sumber, namaBerkas, tutup,
}: {
  buka: boolean;
  judul: string;
  /** Endpoint lampiran, mis. `/jurnal/12/lampiran`. */
  sumber: string;
  /** Nama unduhan tanpa ekstensi, mis. `lampiran-jurnal-2026-01-05`. */
  namaBerkas: string;
  tutup: () => void;
}) {
  const [url, ubahUrl] = useState<string | null>(null);
  const [namaUnduh, ubahNamaUnduh] = useState(namaBerkas + '.jpg');
  const [sedang, ubahSedang] = useState(false);
  const [galat, ubahGalat] = useState<string | null>(null);
  const tombolTutup = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buka) return;
    let lepas: string | null = null;
    let aktif = true;
    ubahUrl(null);
    ubahSedang(true);
    ubahGalat(null);
    api<Response>(sumber, { raw: true })
      .then((r) => r.blob())
      .then((b) => {
        if (!aktif) return;
        lepas = URL.createObjectURL(b);
        ubahNamaUnduh(namaBerkas + ekstensi(b.type));
        ubahUrl(lepas);
      })
      .catch(() => {
        if (aktif) ubahGalat('Foto belum bisa dimuat. Periksa koneksi lalu coba lagi.');
      })
      .finally(() => {
        if (aktif) ubahSedang(false);
      });
    return () => {
      aktif = false;
      if (lepas) URL.revokeObjectURL(lepas);
    };
    // namaBerkas mengikuti sumber; sumber pemicu tunggal agar foto tidak dimuat ulang tiap ketikan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, sumber]);

  useEffect(() => {
    if (!buka) return;
    tombolTutup.current?.focus();
    const kunci = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup();
    };
    document.addEventListener('keydown', kunci);
    return () => document.removeEventListener('keydown', kunci);
  }, [buka, tutup]);

  if (!buka) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={judul}
      onClick={tutup}
    >
      <div
        className="bg-kartu border border-garis rounded-xl p-3 max-w-full max-h-full flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <b className="text-sm truncate">{judul}</b>
          <button
            type="button"
            ref={tombolTutup}
            onClick={tutup}
            aria-label="Tutup foto"
            className="h-8 w-8 grid place-items-center rounded-lg border border-garis text-mu hover:text-teks cursor-pointer bg-transparent shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sedang ? <p className="text-mu text-sm" aria-live="polite">Memuat foto…</p> : null}
        {galat ? (
          <p className="text-r text-sm font-semibold" role="alert" aria-live="polite">{galat}</p>
        ) : null}
        {url ? (
          <img
            src={url}
            alt={judul}
            className="max-h-[70vh] max-w-full rounded-lg border border-garis object-contain"
          />
        ) : null}

        {url ? (
          <a
            href={url}
            download={namaUnduh}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border border-garis text-pr cursor-pointer hover:brightness-110"
          >
            Unduh foto ({namaUnduh})
          </a>
        ) : null}
      </div>
    </div>
  );
}
