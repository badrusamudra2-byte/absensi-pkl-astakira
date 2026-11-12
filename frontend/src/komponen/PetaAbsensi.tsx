import { useEffect, useRef } from 'react';

/** Satu titik absensi pada peta (masuk/pulang) */
export interface TitikPeta {
  lat: number;
  lng: number;
  jenis: 'masuk' | 'pulang';
  label: string; // tooltip: nama peserta + jam
}

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
      <p className="text-mu text-sm">
        Pustaka peta belum termuat. Periksa koneksi internet lalu muat ulang halaman.
      </p>
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
    return () => {
      peta.remove();
      petaRef.current = null;
      lapisanRef.current = null;
    };
  }, []);

  /* Gambar ulang titik & lingkaran kantor saat data berubah */
  useEffect(() => {
    const peta = petaRef.current;
    const lapisan = lapisanRef.current;
    if (!peta || !lapisan) return undefined;
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
    for (const t of titik) {
      const masuk = t.jenis === 'masuk';
      L.marker([t.lat, t.lng], {
        icon: L.divIcon({
          className: '',
          html:
            `<div style="display:flex;align-items:center;justify-content:center;` +
            `width:26px;height:26px;border-radius:50%;color:#fff;font-size:13px;` +
            `font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px #0006;` +
            `background:${masuk ? '#15803d' : '#c2410c'}">` +
            `${masuk ? '&#8594;' : '&#8592;'}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        title: t.label,
      }).bindTooltip(t.label).addTo(lapisan);
      batas.push([t.lat, t.lng]);
    }
    if (batas.length) peta.fitBounds(L.latLngBounds(batas).pad(0.25), { animate: false });
    return undefined;
  }, [titik, kantor]);

  return (
    <div
      ref={kotakRef}
      role="img"
      aria-label="Peta sebaran absensi"
      className="w-full h-[300px] rounded-lg border border-garis z-0"
    />
  );
}
