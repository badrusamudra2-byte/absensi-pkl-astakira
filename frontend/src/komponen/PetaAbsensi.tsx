import { useEffect, useRef } from 'react';
import { Ikon } from './Ikon';

/** Satu titik absensi pada peta (masuk/pulang) */
export interface TitikPeta {
  lat: number;
  lng: number;
  jenis: 'masuk' | 'pulang';
  label: string; // tooltip: nama peserta + jam
  /** Warna khas per peserta, agar titik tiap orang terpisah jelas */
  warna?: string;
}

/** Palet warna titik per peserta (memutar bila peserta lebih banyak). */
export const WARNA_TITIK = [
  '#15803d', '#c2410c', '#1d4ed8', '#7c3aed', '#be123c',
  '#0e7490', '#a16207', '#4d7c0f', '#9333ea', '#0369a1',
];
export const warnaTitik = (kunci: number | undefined) => WARNA_TITIK[(kunci ?? 0) % WARNA_TITIK.length];

export interface PetaAbsensiProps {
  titik: TitikPeta[];
  /** Pusat area kantor + radius lingkaran (null = kantor belum diatur) */
  kantor?: { lat: number; lng: number; radius_m: number } | null;
}

/** Peta Leaflet + tile OpenStreetMap (tanpa API key). Marker absen masuk/pulang
 * dan lingkaran radius kantor. Pustaka Leaflet dimuat lokal dari public/vendor —
 * bila belum termuat, tampilkan teks penjelasan, bukan error. */
export default function PetaAbsensi({ titik, kantor = null }: PetaAbsensiProps) {
  if (typeof L === 'undefined') {
    return (
      <div className="flex flex-col items-center rounded-[12px] border border-dashed border-garis bg-[#fbfcfe] px-4 py-8 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-pl text-pr">
          <Ikon nama="pin" className="size-5" />
        </span>
        <b className="mt-2.5 text-sm">Peta belum termuat</b>
        <p className="mt-1 max-w-[360px] text-xs leading-relaxed text-mu">
          Pustaka peta belum termuat. Periksa koneksi internet lalu muat ulang halaman.
        </p>
      </div>
    );
  }
  return <PetaDalam titik={titik} kantor={kantor} />;
}

/** Peta hanya dirender saat Leaflet siap; kunci agar effect tidak berjalan ulang
 * setiap kali daftar titik berubah — pembaruan titik ditangani effect itu sendiri. */
function PetaDalam({ titik, kantor }: PetaAbsensiProps) {
  const kotakRef = useRef<HTMLDivElement | null>(null);
  const petaRef = useRef<any>(null);
  const lapisanRef = useRef<any>(null);
  const gambarRef = useRef<(() => void) | null>(null);

  /* Buat peta sekali; tile OSM standar, tanpa kunci API */
  useEffect(() => {
    const kotak = kotakRef.current;
    if (!kotak || petaRef.current) return undefined;
    const peta = L.map(kotak, { scrollWheelZoom: true }).setView([-6.2, 106.816], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(peta);
    lapisanRef.current = L.layerGroup().addTo(peta);
    petaRef.current = peta;
    // Zoom berubah -> jarak geser piksel dipetakan ulang ke koordinat
    peta.on('zoomend', () => gambarRef.current?.());
    return () => {
      peta.off('zoomend');
      peta.remove();
      petaRef.current = null;
      lapisanRef.current = null;
      gambarRef.current = null;
    };
  }, []);

  /* Gambar ulang titik & lingkaran kantor saat data berubah (dan saat zoom berubah) */
  useEffect(() => {
    const peta = petaRef.current;
    const lapisan = lapisanRef.current;
    if (!peta || !lapisan) return undefined;

    const gambar = () => {
      lapisan.clearLayers();

      const batas: any[] = [];
      if (kantor) {
        L.circle([kantor.lat, kantor.lng], {
          radius: kantor.radius_m,
          color: '#1d4ed8',
          weight: 1.5,
          fillOpacity: 0.08,
        }).addTo(lapisan);
        batas.push([kantor.lat, kantor.lng]);
      }
      // Kelompokkan titik berkoordinat hampir sama (≈11 m, umumnya lokasi kantor).
      // Anggota yang bertumpuk hanya digeser melingkar ±17 PIKSEL dari titik asli
      // (marker 16 px): nyaris berdempet, cukup terpisah agar tidak saling menutupi,
      // dan makin dekat ke titik sebenarnya saat zoom diperbesar. Titik tunggal
      // tetap tepat di koordinat aslinya.
      const kelompok = new Map<string, { lat: number; lng: number; anggota: TitikPeta[] }>();
      for (const t of titik) {
        const k = `${t.lat.toFixed(4)},${t.lng.toFixed(4)}`;
        const g = kelompok.get(k) ?? { lat: t.lat, lng: t.lng, anggota: [] };
        g.anggota.push(t);
        kelompok.set(k, g);
      }
      for (const g of kelompok.values()) {
        const n = g.anggota.length;
        const asal = n > 1 ? peta.latLngToContainerPoint([g.lat, g.lng]) : null;
        g.anggota.forEach((t, i) => {
          let lat = g.lat;
          let lng = g.lng;
          if (asal) {
            const sudut = (i * 2 * Math.PI) / n;
            const ll = peta.containerPointToLatLng(
              asal.add(L.point(Math.cos(sudut) * 17, Math.sin(sudut) * 17)),
            );
            lat = ll.lat;
            lng = ll.lng;
          }
          const masuk = t.jenis === 'masuk';
          const warna = t.warna ?? (masuk ? '#15803d' : '#c2410c');
          L.marker([lat, lng], {
            icon: L.divIcon({
              className: '',
              html:
                `<div style="display:flex;align-items:center;justify-content:center;` +
                `width:16px;height:16px;border-radius:50%;color:#fff;font-size:9px;` +
                `font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px #0006;` +
                `background:${warna}">` +
                `${masuk ? '&#8594;' : '&#8592;'}</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
            title: t.label,
          }).bindTooltip(t.label).addTo(lapisan);
          batas.push([lat, lng]);
        });
      }
      if (batas.length) peta.fitBounds(L.latLngBounds(batas).pad(0.25), { animate: false });
    };

    gambar();
    gambarRef.current = gambar;
    return () => {
      gambarRef.current = null;
    };
  }, [titik, kantor]);

  return (
    <div
      ref={kotakRef}
      role="img"
      aria-label="Peta sebaran absensi"
      className="z-0 h-[300px] w-full overflow-hidden rounded-[12px] border border-garis shadow-[0_10px_24px_-20px_rgba(11,31,77,.4)]"
    />
  );
}
