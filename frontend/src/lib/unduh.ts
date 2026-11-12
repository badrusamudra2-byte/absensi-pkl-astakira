import { api } from './api';

export type FormatLaporan = 'csv' | 'xlsx' | 'pdf';

/** Unduh berkas laporan (blob mentah dengan token) lalu simpan ke perangkat.
 * Mengembalikan nama berkas yang tersimpan. Melempar ApiError bila server menolak. */
export async function unduhBerkas(path: string, format: FormatLaporan, namaBawaan: string): Promise<string> {
  const res = await api<Response>(`${path}${path.includes('?') ? '&' : '?'}format=${format}`, { raw: true });
  const blob = await res.blob();
  const nama = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `${namaBawaan}.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
  return nama;
}
