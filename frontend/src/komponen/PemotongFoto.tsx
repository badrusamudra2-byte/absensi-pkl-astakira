import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tombol } from './ui';
import { Ikon } from './Ikon';

const jepit = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Pemotong foto profil dengan rasio 4:3. Pengguna dapat menggeser foto dan
 * mengatur zoom; hasil dipotong di kanvas lalu dikirim sebagai JPEG.
 */
export default function PemotongFoto({
  file,
  sedang,
  batal,
  simpan,
}: {
  file: File;
  sedang: boolean;
  batal: () => void;
  simpan: (blob: Blob) => void;
}) {
  const kotakRef = useRef<HTMLDivElement | null>(null);
  const seret = useRef<{ x: number; y: number; gx: number; gy: number } | null>(null);

  const [url, setUrl] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [kotak, setKotak] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [geser, setGeser] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setImg(null);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setZoom(1);
      setGeser({ x: 0, y: 0 });
    };
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useLayoutEffect(() => {
    const el = kotakRef.current;
    if (!el) return;
    const ukur = () => setKotak({ w: el.clientWidth, h: el.clientHeight });
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const kbd = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sedang) batal();
    };
    window.addEventListener('keydown', kbd);
    return () => window.removeEventListener('keydown', kbd);
  }, [batal, sedang]);

  const sampul = img ? Math.max(kotak.w / img.naturalWidth, kotak.h / img.naturalHeight) : 1;
  const dasarW = img ? img.naturalWidth * sampul : 0;
  const dasarH = img ? img.naturalHeight * sampul : 0;
  const maksX = Math.max(0, (dasarW * zoom - kotak.w) / 2);
  const maksY = Math.max(0, (dasarH * zoom - kotak.h) / 2);

  useEffect(() => {
    setGeser((g) => ({ x: jepit(g.x, -maksX, maksX), y: jepit(g.y, -maksY, maksY) }));
  }, [maksX, maksY]);

  const mulaiSeret = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!img || sedang) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seret.current = { x: e.clientX, y: e.clientY, gx: geser.x, gy: geser.y };
  };

  const gerakSeret = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = seret.current;
    if (!s) return;
    const nx = jepit(s.gx + (e.clientX - s.x), -maksX, maksX);
    const ny = jepit(s.gy + (e.clientY - s.y), -maksY, maksY);
    setGeser({ x: nx, y: ny });
  };

  const lepasSeret = () => {
    seret.current = null;
  };

  const potong = () => {
    if (!img || !kotak.w || !kotak.h) return;
    const skala = (dasarW * zoom) / img.naturalWidth;
    const cx = kotak.w / 2 + geser.x;
    const cy = kotak.h / 2 + geser.y;
    const sx = img.naturalWidth / 2 + (0 - cx) / skala;
    const sy = img.naturalHeight / 2 + (0 - cy) / skala;
    const sw = kotak.w / skala;
    const sh = kotak.h / skala;

    const keluarW = Math.min(1024, Math.max(480, Math.round(sw)));
    const keluarH = Math.round((keluarW * 3) / 4);
    const kanvas = document.createElement('canvas');
    kanvas.width = keluarW;
    kanvas.height = keluarH;
    const ctx = kanvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, keluarW, keluarH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, keluarW, keluarH);
    kanvas.toBlob((b) => {
      if (b) simpan(b);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !sedang && batal()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Atur foto profil"
        className="w-full max-w-[520px] bg-kartu rounded-2xl overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-garis">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-pl text-pr grid place-items-center">
              <Ikon nama="camera" className="size-4" />
            </span>
            <b className="text-[13px] font-extrabold">Atur foto profil</b>
          </div>
          <button
            type="button"
            onClick={batal}
            disabled={sedang}
            aria-label="Tutup"
            className="size-8 rounded-lg grid place-items-center text-mu hover:text-teks hover:bg-bg cursor-pointer disabled:opacity-50"
          >
            <Ikon nama="x" className="size-4" />
          </button>
        </div>

        <div className="p-4">
          <div
            ref={kotakRef}
            onPointerDown={mulaiSeret}
            onPointerMove={gerakSeret}
            onPointerUp={lepasSeret}
            onPointerCancel={lepasSeret}
            className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-[#0b1220] touch-none select-none cursor-grab active:cursor-grabbing"
          >
            {url && img && kotak.w ? (
              <img
                src={url}
                alt="Pratinjau foto"
                draggable={false}
                className="absolute max-w-none pointer-events-none select-none"
                style={{
                  width: dasarW,
                  height: dasarH,
                  left: (kotak.w - dasarW) / 2,
                  top: (kotak.h - dasarH) / 2,
                  transform: `translate(${geser.x}px, ${geser.y}px) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[12px] text-[#c7d8f5]">
                Memuat foto…
              </div>
            )}

            <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 border border-white/50" />
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Ikon nama="image" className="size-4 text-mu shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Perbesaran foto"
              className="flex-1 accent-pr"
            />
            <span className="w-10 text-right text-[10.5px] font-bold text-mu">{Math.round(zoom * 100)}%</span>
          </div>
          <p className="text-[10.5px] text-mu mt-2 leading-relaxed">
            Geser foto untuk mengatur posisi, lalu sesuaikan zoom. Foto disimpan dengan rasio 4:3.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-garis flex items-center justify-end gap-2">
          <Tombol varian="gh" onClick={batal} disabled={sedang}>
            Batal
          </Tombol>
          <Tombol onClick={potong} disabled={sedang || !img}>
            <Ikon nama="check" className="size-4" />
            {sedang ? 'Menyimpan…' : 'Gunakan foto'}
          </Tombol>
        </div>
      </div>
    </div>
  );
}
