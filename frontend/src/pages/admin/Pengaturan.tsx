import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLokasi } from '../../lib/lokasi';
import type { MetodeAbsensi, Pengaturan } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Tabel, Label, Masukan } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { Ikon } from '../../komponen/Ikon';

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

  const labelMetode = SESUAI.find((s) => s.metode === isi?.metode)?.label ?? isi?.metode ?? '-';

  return (
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Pengaturan"
        sub="Atur metode absensi, validasi lokasi kantor, dan template wajah peserta."
      />

      <Kartu t="Metode absensi">
        <fieldset disabled={sedang}>
          <legend className="mb-3 text-xs leading-relaxed text-mu">
            Metode berlaku untuk semua peserta.
          </legend>
          <div className="grid gap-2.5">
            {SESUAI.map((k) => {
              const aktif = metode === k.metode;
              return (
                <label
                  key={k.metode}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                    aktif ? 'border-pr bg-pl/40' : 'border-garis bg-kartu hover:border-pr/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="metode"
                    value={k.metode}
                    checked={aktif}
                    onChange={() => ubahMetode(k.metode)}
                    className="mt-0.5 size-4 shrink-0 accent-pr"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <b className="text-sm">{k.label}</b>
                      {aktif ? <span className="rounded-full bg-pr/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-pr">Aktif</span> : null}
                    </span>
                    <small className="mt-0.5 block text-[11px] leading-relaxed text-mu">{k.uraian}</small>
                  </span>
                </label>
              );
            })}
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-garis bg-[#fbfcfe] p-3">
            <input type="checkbox" checked={liveness} onChange={(e) => ubahLiveness(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-pr" />
            <span>
              <b className="block text-xs">Liveness aktif</b>
              <small className="text-[11px] leading-relaxed text-mu">Tantangan gerakan: kedip / tengok / buka mulut.</small>
            </span>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Tombol onClick={() => void simpan()} disabled={sedang || !diubahIsi}>
              <Ikon nama="check" className="size-4" />
              Simpan pengaturan
            </Tombol>
            {!diubahIsi && isi ? (
              <small className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-mu">
                <Ikon nama="checkCircle" className="size-3.5 text-g" />
                Tersimpan: {labelMetode}
              </small>
            ) : null}
          </div>
          {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        </fieldset>
      </Kartu>

      <Kartu t="Lokasi kantor">
        <div className="flex items-start gap-3 rounded-xl border border-[#c7dbff] bg-[#f8fbff] p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-pr shadow-sm">
            <Ikon nama="pin" className="size-4" />
          </span>
          <p className="text-[11.5px] leading-relaxed text-mu">
            Ketika koordinat kantor diisi, peserta wajib berada di dalam radius ini saat absen (QR maupun wajah).
            Kosongkan garis lintang dan garis bujur untuk menonaktifkan validasi lokasi.
          </p>
        </div>

        <fieldset disabled={sedangLok || sedang}>
          <div className="mt-3 grid max-w-[680px] gap-x-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ktr_lat" className="mt-0">Garis lintang (latitude)</Label>
              <Masukan id="ktr_lat" type="number" step="0.000001" min={-90} max={90} value={fLat}
                onChange={(e) => ubahFLat(e.target.value)} placeholder="Misal: -6.200000" />
            </div>
            <div>
              <Label htmlFor="ktr_lng" className="mt-0">Garis bujur (longitude)</Label>
              <Masukan id="ktr_lng" type="number" step="0.000001" min={-180} max={180} value={fLng}
                onChange={(e) => ubahFLng(e.target.value)} placeholder="Misal: 106.816000" />
            </div>
            <div>
              <Label htmlFor="ktr_rad">Radius area (meter, 20–10000)</Label>
              <Masukan id="ktr_rad" type="number" step={10} min={20} max={10000} value={fRadius}
                onChange={(e) => ubahFRadius(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ktr_akr">Akurasi GPS maksimal (meter, 5–500)</Label>
              <Masukan id="ktr_akr" type="number" step={5} min={5} max={500} value={fAkurasi}
                onChange={(e) => ubahFAkurasi(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Tombol varian="gh" onClick={() => void isiLokasi()} disabled={sedangLok || sedang}>
              <Ikon nama="pin" className="size-4" />
              Gunakan lokasi perangkat ini
            </Tombol>
            <Tombol onClick={() => void simpanLokasi()} disabled={sedangLok || sedang || isi === null || !diubahLok(isi)}>
              Simpan lokasi kantor
            </Tombol>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-mu">
            <Ikon nama="info" className="mt-0.5 size-3.5 shrink-0" />
            “Gunakan lokasi perangkat ini” mengisi koordinat dari GPS browser — jalankan di perangkat yang benar-benar berada di kantor.
          </p>
          {galatLok ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galatLok[0]} uraian={galatLok[1]} /></div> : null}
        </fieldset>
      </Kartu>

      <Kartu t="Reset template wajah">
        <p className="max-w-[620px] text-xs leading-relaxed text-mu">
          Menghapus template wajah peserta supaya mereka dapat mendaftar ulang.
        </p>
        {daftar === null ? (
          <p className="mt-3 text-sm text-mu">Daftar peserta gagal dimuat — pastikan server aktif.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resetWajah();
            }}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <div className="min-w-[220px] flex-1 sm:max-w-[420px]">
              <Label htmlFor="pil_psr" className="mt-0">Pilih peserta</Label>
              <select
                id="pil_psr"
                value={pilih ?? ''}
                onChange={(e) => ubahPilih(e.target.value ? Number(e.target.value) : null)}
                className="mt-1 h-[38px] w-full rounded-lg border border-garis bg-bg px-[11px] text-sm outline-none focus:border-pr focus:ring-4 focus:ring-pr/10"
              >
                <option value="">— pilih —</option>
                {daftar.map((d) => (
                  <option key={d.id} value={d.id}>{d.nama} ({d.email})</option>
                ))}
              </select>
            </div>
            <Tombol type="submit" varian="dg" disabled={pilih === null || sedang}>
              <Ikon nama="refresh" className="size-4" />
              Reset template wajah
            </Tombol>
          </form>
        )}
        <div className="mt-4">
          <Tabel
            h={['Nama', 'Email']}
            rows={(daftar ?? []).map((d) => [d.nama, d.email])}
            em="Tidak ada peserta terdaftar."
          />
          <p className="mt-2">
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-pr">
              <Ikon nama="arrow" className="size-3 rotate-180" />
              Kembali ke beranda
            </Link>
          </p>
        </div>
      </Kartu>
    </>
  );
}
