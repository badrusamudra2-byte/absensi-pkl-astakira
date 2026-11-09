/** Sinyal kecil antar komponen: beritahu TitikBaru (Shell) agar tidakifikasi pengajuan
 * izin/sakit diperiksa ulang segera — setelah putusan pembimbing atau berpindah halaman. */
const pendengar = new Set<() => void>();

export const sinyalPeriksa = () => pendengar.forEach((f) => f());

export const ikutSinyal = (f: () => void) => {
  pendengar.add(f);
  return () => pendengar.delete(f);
};
