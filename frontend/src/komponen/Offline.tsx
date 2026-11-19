import { useEffect, useState } from 'react';
import { Ikon } from './Ikon';

/** Status daring/luring browser, memakai event online/offline (bukan sekadar baca sekali). */
export function useOnline(): boolean {
  const [daring, ubah] = useState(() => navigator.onLine);
  useEffect(() => {
    const naik = () => ubah(true);
    const turun = () => ubah(false);
    window.addEventListener('online', naik);
    window.addEventListener('offline', turun);
    return () => {
      window.removeEventListener('online', naik);
      window.removeEventListener('offline', turun);
    };
  }, []);
  return daring;
}

/** Pita luring global, di atas isi halaman. Hilang sendiri saat koneksi kembali. */
export default function BannerLuring() {
  const daring = useOnline();
  if (daring) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 border-b border-[#f0c36b] bg-[#fffbeb] px-4 py-2.5 text-[#713f12]"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#a1620716] text-y">
        <Ikon nama="alert" className="size-3.5" />
      </span>
      <p className="text-xs font-semibold leading-snug">
        Anda sedang luring. Absen, kirim jurnal, dan pembacaan data membutuhkan koneksi internet.
      </p>
    </div>
  );
}
