import type { PesanApi } from './tipe';

const KUNCI_TOKEN = 'astakira_token';

export function dapatkanToken(): string | null {
  return sessionStorage.getItem(KUNCI_TOKEN);
}

export function simpanToken(t: string): void {
  sessionStorage.setItem(KUNCI_TOKEN, t);
}

export function bersihkanToken(): void {
  sessionStorage.removeItem(KUNCI_TOKEN);
}

export class ApiError extends Error {
  readonly status: number;
  readonly kode: string;
  constructor(status: number, pesan: string, kode: string) {
    super(pesan);
    this.status = status;
    this.kode = kode;
  }
}

interface Opsi extends RequestInit {
  /** Lewati jika body bukan JSON (mis. FormData untuk unggah foto). */
  json?: unknown;
  /** Kirim multi bagian (FormData) — biarkan browser menatap batas (multipart) sendiri. */
  bentuk?: FormData;
  /** Berguna untuk unduhan berkas. */
  raw?: boolean;
}

export async function api<T>(path: string, opsi: Opsi = {}): Promise<T> {
  const { json, bentuk, raw, headers, ...rest } = opsi;
  const token = dapatkanToken();

  const res = await fetch('/api' + path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(bentuk !== undefined ? { body: bentuk } : {}),
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  // Sesi hilang: bersihkan dan tampilkan halaman login. Percobaan login/reset yang
  // 401 (sandi salah dsb.) TIDAK me-redirect — biarkan pesan galat tampil di form.
  if (
    res.status === 401 &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/reset-password')
  ) {
    bersihkanToken();
    window.location.assign('/login');
  }
  if (!res.ok) {
    let bukan: PesanApi | null = null;
    try {
      bukan = (await res.json()) as PesanApi;
    } catch {
      /* respons bukan JSON — tangani di bawah */
    }
    throw new ApiError(res.status, bukan?.pesan ?? 'Terjadi kesalahan pada server.', bukan?.kode ?? 'SERVER');
  }
  return raw ? (res as unknown as T) : ((await res.json()) as T);
}
