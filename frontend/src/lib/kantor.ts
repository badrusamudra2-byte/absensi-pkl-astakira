import { api } from './api';
import type { Pengaturan } from './tipe';

/** Titik kantor dari pengaturan absensi (null = belum diatur, validasi lokasi nonaktif). */
export interface LokasiKantor {
  lat: number;
  lng: number;
  radius_m: number;
}

/** Ambil posisi kantor; null bila kantor belum diatur atau gagal diketahui. */
export async function ambilLokasiKantor(): Promise<LokasiKantor | null> {
  try {
    const r = await api<Pengaturan>('/pengaturan/absensi');
    if (r.lat_kantor === null || r.lng_kantor === null) return null;
    return { lat: r.lat_kantor, lng: r.lng_kantor, radius_m: r.radius_m };
  } catch {
    return null;
  }
}

/** Format jarak untuk ditampilkan: meter di bawah 1 km, kilometer di atasnya. */
export function teksJarak(m: number | null | undefined): string {
  if (m === null || m === undefined) return '-';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
