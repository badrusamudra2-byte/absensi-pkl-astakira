import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Ikon } from './Ikon';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07152e]/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={judul}
      onClick={tutup}
    >
      <div
        className="flex max-h-full w-full max-w-[900px] flex-col gap-3 rounded-2xl border border-garis bg-kartu p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-pl text-pr">
              <Ikon nama="image" className="size-3.5" />
            </span>
            <b className="truncate text-sm">{judul}</b>
          </div>
          <button
            type="button"
            ref={tombolTutup}
            onClick={tutup}
            aria-label="Tutup foto"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-garis bg-kartu text-mu transition hover:border-pr/40 hover:text-teks"
          >
            <Ikon nama="x" className="size-4" />
          </button>
        </div>

        {sedang ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-mu" aria-live="polite">
            <span className="size-4 animate-spin rounded-full border-2 border-pr/20 border-t-pr" aria-hidden="true" />
            Memuat foto&hellip;
          </div>
        ) : null}

        {galat ? (
          <div className="flex items-start gap-2 rounded-lg border border-r bg-[#b91c1c10] px-3 py-2.5 text-r" role="alert" aria-live="polite">
            <Ikon nama="alert" className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm font-semibold">{galat}</p>
          </div>
        ) : null}

        {url ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#0b1f4d] p-2">
            <img
              src={url}
              alt={judul}
              className="max-h-[70vh] max-w-full rounded-lg object-contain"
            />
          </div>
        ) : null}

        {url ? (
          <a
            href={url}
            download={namaUnduh}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-garis bg-kartu px-4 py-2 text-sm font-semibold text-pr transition hover:border-pr hover:bg-pl"
          >
            <Ikon nama="download" className="size-4" />
            Unduh foto ({namaUnduh})
          </a>
        ) : null}
      </div>
    </div>
  );
}
