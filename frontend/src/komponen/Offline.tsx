import { useEffect, useState } from 'react';

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
      className="bg-[#fef3c7] border-b border-[#a16207] text-[#713f12] px-4 py-2 text-sm font-semibold flex items-center gap-2"
    >
      <span aria-hidden="true">&#9888;</span>
      Anda sedang luring. Absen, kirim jurnal, dan pembacaan data butuh koneksi internet.
    </div>
  );
}
