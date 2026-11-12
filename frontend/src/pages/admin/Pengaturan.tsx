import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLokasi } from '../../lib/lokasi';
import type { MetodeAbsensi, Pengaturan } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Tabel } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';

const SESUAI: { metode: MetodeAbsensi; label: string; uraian: string }[] = [
  { metode: 'qr_wajah', label: 'QR + wajah', uraian: 'Peserta memverifikasi wajahnya sendiri di HP-nya (foto wajah saat absensi tersimpan terenkripsi untuk rekap), lalu menayangkan QR; pembimbing cukup memindai QR-nya.' },
  { metode: 'qr', label: 'QR saja', uraian: 'Peserta menayangkan QR-nya; pembimbing memindai — tanpa verifikasi wajah.' },
  { metode: 'wajah', label: 'Wajah saja', uraian: 'Peserta absen langsung dari HP-nya: wajah cocok dan liveness lolos, absensi (beserta foto) tercatat — tanpa QR.' },
];

type BarisPsrt = { id: number; nama: string; email: string };

export default function Pengaturan() {
  const toast = useToast();
  const [isi, ubahIsi] = useState<Pengaturan | null>(null);
  const [metode, ubahMetode] = useState<MetodeAbsensi>('qr_wajah');
  const [liveness, ubahLiveness] = useState(true);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [daftar, ubahDaftar] = useState<BarisPsrt[] | null>(null);
  const [pilih, ubahPilih] = useState<number | null>(null);
  // Lokasi kantor: string agar input kosong = belum diatur (null di server)
  const [fLat, ubahFLat] = useState('');
  const [fLng, ubahFLng] = useState('');
  const [fRadius, ubahFRadius] = useState('');
  const [fAkurasi, ubahFAkurasi] = useState('');
  const [galatLok, ubahGalatLok] = useState<[string, string] | null>(null);
  const [sedangLok, ubahSedangLok] = useState(false);

  const keNullKosong = (v: string) => (v.trim() === '' ? null : Number(v));

  useEffect(() => {
    api<Pengaturan>('/pengaturan/absensi')
      .then((r) => {
        ubahIsi(r);
        ubahMetode(r.metode);
        ubahLiveness(r.liveness_aktif);
        ubahFLat(r.lat_kantor === null ? '' : String(r.lat_kantor));
        ubahFLng(r.lng_kantor === null ? '' : String(r.lng_kantor));
        ubahFRadius(String(r.radius_m));
        ubahFAkurasi(String(r.akurasi_maks_m));
      })
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
    api<{ data: BarisPsrt[] }>('/admin/peserta')
      .then((r) => ubahDaftar(r.data))
      .catch(() => ubahDaftar(null));
  }, []);

  const simpan = async () => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pengaturan: Pengaturan }>('/pengaturan/absensi', {
        method: 'PUT',
        json: { metode, liveness_aktif: liveness },
      });
      ubahIsi(r.pengaturan);
      toast('Pengaturan absensi disimpan.');
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedang(false);
    }
  };

  const diubahIsi = !isi || isi.metode !== metode || isi.liveness_aktif !== liveness;

  const diubahLok = (p: Pengaturan) =>
    fLat.trim() === '' ? p.lat_kantor !== null :
      p.lat_kantor === null ||
      Number(fLat) !== p.lat_kantor ||
      Number(fLng) !== p.lng_kantor ||
      Number(fRadius) !== p.radius_m ||
      Number(fAkurasi) !== p.akurasi_maks_m;

  const isiLokasi = async () => {
    ubahGalatLok(null);
    try {
      const l = await ambilLokasi();
      ubahFLat(String(l.lat));
      ubahFLng(String(l.lng));
      ubahFAkurasi(String(Math.round(l.akurasi_m)));
      toast('Koordinat kantor terisi dari posisi perangkat ini.');
    } catch (e) {
      ubahGalatLok(['Lokasi tidak didapat', (e as Error).message]);
    }
  };

  const simpanLokasi = async () => {
    if (isi === null) return;
    const lat = keNullKosong(fLat);
    const lng = keNullKosong(fLng);
    if ((lat === null) !== (lng === null)) {
      ubahGalatLok(['Data belum lengkap', 'Isi keduanya: garis lintang dan garis bujur kantor, atau kosongkan keduanya untuk menonaktifkan validasi lokasi.']);
      return;
    }
    ubahSedangLok(true);
    ubahGalatLok(null);
    try {
      const r = await api<{ pengaturan: Pengaturan }>('/pengaturan/absensi', {
        method: 'PUT',
        json: {
          metode, liveness_aktif: liveness,
          lat_kantor: lat, lng_kantor: lng,
          radius_m: Number(fRadius), akurasi_maks_m: Number(fAkurasi),
        },
      });
      ubahIsi(r.pengaturan);
      ubahFLat(r.pengaturan.lat_kantor === null ? '' : String(r.pengaturan.lat_kantor));
      ubahFLng(r.pengaturan.lng_kantor === null ? '' : String(r.pengaturan.lng_kantor));
      toast('Lokasi kantor disimpan.');
    } catch (e) {
      const err = e as ApiError;
      ubahGalatLok(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedangLok(false);
    }
  };

  const resetWajah = useCallback(async () => {
    if (pilih === null) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string }>(`/admin/face/${pilih}`, { method: 'DELETE' });
      toast(r.pesan);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedang(false);
    }
  }, [pilih, toast]);

  return (
    <>
      <Kartu t="Pengaturan absensi">
        <fieldset disabled={sedang}>
          <legend className="text-sm font-semibold mb-2">Metode absensi untuk semua peserta</legend>
          {SESUAI.map((k) => (
            <label key={k.metode} className="flex items-start gap-2 my-2">
              <input
                type="radio"
                name="metode"
                value={k.metode}
                checked={metode === k.metode}
                onChange={() => ubahMetode(k.metode)}
                className="mt-1"
              />
              <span>
                <b>{k.label}</b>
                <small className="block text-mu">{k.uraian}</small>
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 mt-3">
            <input type="checkbox" checked={liveness} onChange={(e) => ubahLiveness(e.target.checked)} />
            Liveness aktif (tantangan gerakan: kedip / tengok / buka mulut)
          </label>
          <div className="mt-3 flex items-center gap-3">
            <Tombol onClick={() => void simpan()} disabled={sedang || !diubahIsi}>Simpan pengaturan</Tombol>
            {!diubahIsi && isi ? <small className="text-mu">Perubahan sejak: {isi.metode}</small> : null}
          </div>
          {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        </fieldset>
      </Kartu>

      <Kartu t="Lokasi kantor">
        <p className="text-mu text-sm">
          Ketika koordinat kantor diisi, peserta wajib berada di dalam radius ini saat absen (QR maupun wajah).
          Kosongkan garis lintang dan garis bujur untuk menonaktifkan validasi lokasi.
        </p>
        <fieldset disabled={sedangLok || sedang} className="mt-2">
          <p className="grid gap-2 sm:grid-cols-2 max-w-[640px]">
            <p>
              <label htmlFor="ktr_lat" className="block text-[13px] font-semibold mb-1">Garis lintang (latitude)</label>
              <input id="ktr_lat" type="number" step="0.000001" min={-90} max={90} value={fLat}
                onChange={(e) => ubahFLat(e.target.value)}
                className="block w-full px-[11px] py-2 border border-garis rounded-lg bg-bg"
                placeholder="Misal: -6.200000" />
            </p>
            <p>
              <label htmlFor="ktr_lng" className="block text-[13px] font-semibold mb-1">Garis bujur (longitude)</label>
              <input id="ktr_lng" type="number" step="0.000001" min={-180} max={180} value={fLng}
                onChange={(e) => ubahFLng(e.target.value)}
                className="block w-full px-[11px] py-2 border border-garis rounded-lg bg-bg"
                placeholder="Misal: 106.816000" />
            </p>
            <p>
              <label htmlFor="ktr_rad" className="block text-[13px] font-semibold mb-1">Radius area (meter, 20–10000)</label>
              <input id="ktr_rad" type="number" step={10} min={20} max={10000} value={fRadius}
                onChange={(e) => ubahFRadius(e.target.value)}
                className="block w-full px-[11px] py-2 border border-garis rounded-lg bg-bg" />
            </p>
            <p>
              <label htmlFor="ktr_akr" className="block text-[13px] font-semibold mb-1">Akurasi GPS maksimal (meter, 5–500)</label>
              <input id="ktr_akr" type="number" step={5} min={5} max={500} value={fAkurasi}
                onChange={(e) => ubahFAkurasi(e.target.value)}
                className="block w-full px-[11px] py-2 border border-garis rounded-lg bg-bg" />
            </p>
          </p>
          <p className="mt-3 flex flex-wrap gap-2 items-center">
            <Tombol onClick={() => void isiLokasi()} disabled={sedangLok || sedang}>Gunakan lokasi perangkat ini…</Tombol>
            <Tombol onClick={() => void simpanLokasi()} disabled={sedangLok || sedang || isi === null || !diubahLok(isi)}>
              Simpan lokasi kantor
            </Tombol>
          </p>
          <p className="text-mu text-xs mt-1">
            “Gunakan lokasi perangkat ini” mengisi koordinat dari GPS browser — jalankan di perangkat yang benar-benar berada di kantor.
          </p>
          {galatLok ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galatLok[0]} uraian={galatLok[1]} /></div> : null}
        </fieldset>
      </Kartu>

      <Kartu t="Reset template wajah peserta">
        <p className="text-mu text-sm mb-2">
          Menghapus template wajah peserta supaya mereka dapat mendaftar ulang.
        </p>
        {daftar === null ? (
          <p className="text-mu text-sm">Daftar peserta gagal dimuat — pastikan server aktif.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resetWajah();
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <p>
              <label htmlFor="pil_psr" className="block text-[13px] font-semibold mb-1">Pilih peserta</label>
              <select
                id="pil_psr"
                value={pilih ?? ''}
                onChange={(e) => ubahPilih(e.target.value ? Number(e.target.value) : null)}
                className="px-[11px] py-2 border border-garis rounded-lg bg-bg"
              >
                <option value="">— pilih —</option>
                {daftar.map((d) => (
                  <option key={d.id} value={d.id}>{d.nama} ({d.email})</option>
                ))}
              </select>
            </p>
            <p>
              <Tombol type="submit" varian="dg" disabled={pilih === null || sedang}>Reset template wajah</Tombol>
            </p>
          </form>
        )}
        <div className="mt-3">
          <Tabel
            h={['Nama', 'Email']}
            rows={(daftar ?? []).map((d) => [d.nama, d.email])}
            em="Tidak ada peserta terdaftar."
          />
          <p className="mt-2"><Link to="/" className="text-pr underline text-sm">Kembali ke beranda</Link></p>
        </div>
      </Kartu>
    </>
  );
}
