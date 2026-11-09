/** Pustaka wajah sisi browser: MediaPipe Face Landmarker (model & wasm disajikan
 * dari proyek sendiri di /wajah/, bukan CDN). Semua olahan di perangkat;
 * yang dikirim ke server hanya embedding dan hasil pengukuran gerakan. */
import { FilesetResolver, FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const DASAR = '/wajah';
let landmarker: FaceLandmarker | null = null;

export const KODE_GERAKAN = ['kedip', 'tengok_kiri', 'tengok_kanan', 'buka_mulut'] as const;
export type KodeGerakan = (typeof KODE_GERAKAN)[number];

export function teksGerakan(k: KodeGerakan): string {
  switch (k) {
    case 'kedip': return 'Kedipkan mata dua kali perlahan.';
    case 'tengok_kiri': return 'Tengok ke kiri, lalu kembali menghadap kamera.';
    case 'tengok_kanan': return 'Tengok ke kanan, lalu kembali menghadap kamera.';
    case 'buka_mulut': return 'Buka mulut, lalu tutup kembali.';
  }
}

/** Muat (sekali) landmarker; GPU bila tersedia, fallback ke CPU. */
export async function ambilLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker;
  const berkas = await FilesetResolver.forVisionTasks(`${DASAR}/wasm`);
  const hari = { baseOptions: { modelAssetPath: `${DASAR}/face_landmarker.task` }, runningMode: 'VIDEO' as const, numFaces: 2 };
  try {
    landmarker = await FaceLandmarker.createFromOptions(berkas, { ...hari, baseOptions: { ...hari.baseOptions, delegate: 'GPU' } });
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(berkas, hari);
  }
  return landmarker;
}

export type Kondisi = 'TIDAK_ADA_WAJAH' | 'WAJAH_GANDA' | 'TERLALU_GELAP' | null;

/* ---------- Ukuran kualitas sekali per frame ---------- */

const kanvasCahaya = document.createElement('canvas');
kanvasCahaya.width = 48;
kanvasCahaya.height = 36;
const kctx = kanvasCahaya.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;

/** Rata-rata kecerahan luma 0..1; benda < 0.2 dianggap terlalu gelap. */
export function kecerahan(video: HTMLVideoElement): number {
  if (!kctx) return 1;
  kctx.drawImage(video, 0, 0, 48, 36);
  const d = kctx.getImageData(0, 0, 48, 36).data;
  let total = 0;
  for (let i = 0; i < d.length; i += 4) total += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return total / (d.length / 4) / 255;
}

/* ---------- Embedding (harus konsisten dengan kalibrasi pendaftaran) ---------- */

/** Indeks 64 titik tersebar dari 468 landmark -> 64*2 = 128 angka (FACE_DIM backend). */
const INDEKS = Array.from({ length: 64 }, (_, i) => Math.floor((i + 0.5) * (468 / 64)));

/** Wujud embedding: ternormalisasi terhadap pusat antar-telinga dan jarak telinga,
 * sehingga tidak bergantung posisi/jarak kamera. */
export function hitungEmbedding(lm: { x: number; y: number }[]): number[] {
  const telinga = [lm[33], lm[263]];
  const cx = (telinga[0].x + telinga[1].x) / 2;
  const cy = (telinga[0].y + telinga[1].y) / 2;
  const skala = Math.hypot(telinga[1].x - telinga[0].x, telinga[1].y - telinga[0].y) || 1;
  const out: number[] = [];
  for (const i of INDEKS) {
    out.push((lm[i].x - cx) / skala, (lm[i].y - cy) / skala);
  }
  return out.slice(0, 128);
}

/* ---------- Mesin gerakan untuk tantangan liveness ---------- */

type Bahasa = { categories: { categoryName: string; score: number }[] } | undefined;
function nilaiSel(raw: Bahasa): { nama: string; skor: number }[] {
  const daftar = raw?.categories ?? [];
  return daftar.map((c) => ({ nama: c.categoryName, skor: c.score }));
}

export type DapatGerakan = {
  kondisi: Kondisi;
  selesai: boolean;
  pesan: string | null; // pesan proses gerakan saat ini
  maju: number; // 0..1 untuk bar progres
};

/** Mesin liveness per tantangan: memantau gerakan sampai instruksi terpenuhi. */
export class MesinGerakan {
  private fase = 0; // tahapan gerakan (0 belum, 1 mencapai ekstrem, dst.)
  private keriput = 0; // hitungan kedip
  private tertutupSebelumnya = false;

  constructor(private kode: KodeGerakan) {}

  /** Panggil tiap frame dengan hasil landmarker; kondisi layak ditangani dulu di luar. */
  feed(res: FaceLandmarkerResult): DapatGerakan {
    const wajah = res.faceLandmarks ?? [];
    if (wajah.length === 0) return { kondisi: 'TIDAK_ADA_WAJAH', selesai: false, pesan: null, maju: 0 };
    if (wajah.length > 1) return { kondisi: 'WAJAH_GANDA', selesai: false, pesan: null, maju: this.majuKini() };
    const bentuk = nilaiSel((res.faceBlendshapes ?? [])[0]);
    const skor = (n: string) => bentuk.find((b) => b.nama === n)?.skor ?? 0;
    const licing = skor('eyeBlinkLeft'), licing2 = skor('eyeBlinkRight');
    const rahang = skor('jawOpen');

    const menutup = licing > 0.5 && licing2 > 0.5;
    let pesan: string | null = null;

    switch (this.kode) {
      case 'kedip': {
        if (menutup && !this.tertutupSebelumnya) this.keriput += 1;
        this.tertutupSebelumnya = menutup;
        pesan = `Kedip ${this.keriput}/2`;
        return { kondisi: null, selesai: this.keriput >= 2, pesan, maju: Math.min(1, this.keriput / 2) };
      }
      case 'buka_mulut': {
        if (this.fase === 0 && rahang > 0.5) {
          this.fase = 1;
          pesan = 'Tutup kembali mulut Anda.';
        } else if (this.fase === 1 && rahang < 0.3) {
          this.fase = 2;
          return { kondisi: null, selesai: true, pesan: 'Siap!', maju: 1 };
        } else if (this.fase === 0) {
          pesan = 'Buka mulut…';
        }
        return { kondisi: null, selesai: false, pesan, maju: this.fase / 2 };
      }
      default: {
        // tengok kiri/kanan: geser hidung (x) relatif pusat antar-telinga
        const lm1 = wajah[0][1], lt = wajah[0][33], rt = wajah[0][263];
        const pusat = (lt.x + rt.x) / 2;
        const lebar = Math.abs(rt.x - lt.x);
        const geser = (lm1.x - pusat) / (lebar * 0.5);
        const harusKiri = this.kode === 'tengok_kiri';
        const ekstrem = harusKiri ? geser < -0.35 : geser > 0.35;
        const tengah = Math.abs(geser) < 0.12;
        if (this.fase === 0) {
          pesan = ekstrem ? 'Kembali ke posisi menghadap kamera.' : harusKiri ? 'Tengok lebih ke kiri…' : 'Tengok lebih ke kanan…';
          if (ekstrem) this.fase = 1;
        }
        if (this.fase === 1) {
          pesan = tengah ? 'Siap!' : 'Kembali menghadap kamera…';
          if (tengah) return { kondisi: null, selesai: true, pesan: 'Siap!', maju: 1 };
        }
        return { kondisi: null, selesai: false, pesan, maju: this.fase / 2 };
      }
    }
  }

  private majuKini(): number {
    if (this.kode === 'kedip') return Math.min(1, this.keriput / 2);
    return this.fase / 2;
  }
}

/** Cek kondisi bingkai: jumlah wajah + kecerahan. Dipanggil tiap frame sebelum feed. */
export function cekKondisi(res: FaceLandmarkerResult, video: HTMLVideoElement): Kondisi {
  const wajah = res.faceLandmarks ?? [];
  if (wajah.length > 1) return 'WAJAH_GANDA';
  if (wajah.length === 0) return 'TIDAK_ADA_WAJAH';
  if (kecerahan(video) < 0.18) return 'TERLALU_GELAP';
  return null;
}

export const PESAN_KONDISI: Record<Exclude<Kondisi, null>, string> = {
  TIDAK_ADA_WAJAH: 'Wajah tidak terlihat. Hadapkan wajah lurus ke dalam bingkai.',
  WAJAH_GANDA: 'Terdeteksi lebih dari satu wajah. Cukup Anda saja di dalam bingkai.',
  TERLALU_GELAP: 'Gambar terlalu gelap. Cari tempat dengan cahaya lebih cukup.',
};
